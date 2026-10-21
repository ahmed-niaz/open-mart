import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
  type RawBodyRequest,
} from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { ConfigService } from '@nestjs/config';

import { InitiatePaymentCommand } from '../application/use-cases/initiate-payment/initiate-payment.command.js';
import { ProcessWebhookCommand } from '../application/use-cases/process-webhook/process-webhook.command.js';
import { HandleRedirectCallbackCommand } from '../application/use-cases/handle-redirect-callback/handle-redirect-callback.command.js';
import { VerifyStripeSessionCommand } from '../application/use-cases/verify-stripe-session/verify-stripe-session.command.js';
import { CancelPaymentCommand } from '../application/use-cases/cancel-payment/cancel-payment.command.js';
import { GetPaymentByOrderIdQuery } from '../application/queries/get-payment-by-order-id/get-payment-by-order-id.query.js';
import { InitiatePaymentDto } from './dto/initiate-payment.dto.js';
import { OptionalJwtAuthGuard } from '../../shared/infrastructure/guards/optional-jwt-auth.guard.js';
import { IdempotencyService } from '../../shared/infrastructure/idempotency/idempotency.service.js';

@Controller('payments')
export class PaymentController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
    private readonly configService: ConfigService,
    private readonly idempotencyService: IdempotencyService,
  ) {}

  /**
   * POST /api/payments/initiate
   * Start a payment session for an order via Stripe, COD, or SSLCommerz.
   * Requires header: X-Idempotency-Key
   */
  @Post('initiate')
  @HttpCode(HttpStatus.OK)
  @UseGuards(OptionalJwtAuthGuard)
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  async initiatePayment(
    @Body() dto: InitiatePaymentDto,
    @Headers('x-idempotency-key') idempotencyKey?: string,
  ) {
    const key = idempotencyKey?.trim();
    if (!key || key.length < 8 || key.length > 128) {
      throw new BadRequestException(
        'X-Idempotency-Key header is required (8-128 characters)',
      );
    }

    const scope = dto.customerEmail
      ? `guest:${dto.customerEmail.toLowerCase().trim()}`
      : 'guest:anonymous';
    const requestPath = '/api/payments/initiate';

    const check = await this.idempotencyService.checkKey(
      key,
      scope,
      requestPath,
      dto,
    );
    if (check.cached) {
      return check.responseBody;
    }

    const result = await this.commandBus.execute(
      new InitiatePaymentCommand(
        dto.orderId,
        dto.provider,
        key,
        dto.customerEmail,
      ),
    );

    const responsePayload = { data: result };
    await this.idempotencyService.recordCompleted(
      null,
      key,
      scope,
      requestPath,
      dto,
      HttpStatus.OK,
      responsePayload,
    );

    return responsePayload;
  }

  /**
   * GET /api/payments/stripe/verify-session
   * Verify a Stripe Checkout Session by calling Stripe's API directly.
   * Called on success redirect so the payment & order status update
   * even if webhooks haven't arrived (critical for local dev).
   *
   * Query params: ?session_id=cs_test_...&order_id=...
   */
  @Get('stripe/verify-session')
  async verifyStripeSession(
    @Query('session_id') sessionId: string,
    @Query('order_id') orderId: string,
    @Res() res: Response,
  ) {
    if (!sessionId) {
      throw new BadRequestException('session_id query parameter is required');
    }

    const result = await this.commandBus.execute(
      new VerifyStripeSessionCommand(sessionId),
    );

    // Redirect to frontend success/failure page
    const frontendUrl =
      this.configService.get<string>('FRONTEND_URL') || 'http://localhost:3000';

    if (result.status === 'completed') {
      return res.redirect(
        `${frontendUrl}/payment/success?order_id=${result.orderId}&payment_id=${result.paymentId}`,
      );
    }

    // If not completed yet, redirect with pending status
    return res.redirect(
      `${frontendUrl}/payment/pending?order_id=${result.orderId}&status=${result.status}`,
    );
  }

  /**
   * GET /api/payments/stripe/cancel
   * Called when customer cancels or backs out of Stripe Checkout.
   * Cancels payment locally, emits cancellation event (sending email),
   * and redirects to frontend cancel page.
   */
  @Get('stripe/cancel')
  async cancelStripeSession(
    @Query('order_id') orderId: string,
    @Res() res: Response,
  ) {
    if (orderId) {
      try {
        await this.commandBus.execute(
          new CancelPaymentCommand(
            orderId,
            'Customer cancelled Stripe Checkout session',
          ),
        );
      } catch {
        // Continue to redirect even if payment already cancelled
      }
    }

    const frontendUrl =
      this.configService.get<string>('FRONTEND_URL') || 'http://localhost:3000';
    return res.redirect(
      `${frontendUrl}/payment/cancel?order_id=${orderId ?? ''}`,
    );
  }

  /**
   * POST /api/payments/webhook/:provider
   * Inbound webhook receiver for payment gateways (e.g. Stripe, SSLCommerz).
   * Verified via HMAC or gateway-specific signature check.
   */
  @Post('webhook/:provider')
  @HttpCode(HttpStatus.OK)
  async handleWebhook(
    @Param('provider') provider: string,
    @Req() req: RawBodyRequest<Request>,
  ) {
    const normalizedProvider = provider.toLowerCase().trim();
    if (
      normalizedProvider !== 'stripe' &&
      normalizedProvider !== 'cod' &&
      normalizedProvider !== 'sslcommerz'
    ) {
      throw new BadRequestException(
        `Unsupported payment provider: ${provider}`,
      );
    }

    const result = await this.commandBus.execute(
      new ProcessWebhookCommand({
        provider: normalizedProvider,
        rawBody: req.rawBody,
        headers: req.headers,
        query: req.query as Record<string, any>,
        body: req.body as Record<string, any>,
      }),
    );

    return result;
  }

  /**
   * GET /api/payments/sslcommerz/verify
   * Direct verification endpoint for SSLCommerz transactions.
   * Completes payment, confirms order, and emits notifications.
   */
  @Get('sslcommerz/verify')
  async verifySslCommerzPayment(
    @Query('order_id') orderId: string,
    @Query('transaction_id') transactionId?: string,
    @Query('val_id') valId?: string,
  ) {
    if (!orderId) {
      throw new BadRequestException('order_id query parameter is required');
    }

    const payload: Record<string, any> = {
      order_id: orderId,
      value_a: orderId,
      status: 'VALID',
    };
    if (transactionId) payload.tran_id = transactionId;
    if (valId) payload.val_id = valId;

    const result = await this.commandBus.execute(
      new HandleRedirectCallbackCommand('sslcommerz', payload),
    );

    return { data: result };
  }

  /**
   * POST /api/payments/redirect/:provider/callback
   * Server callback endpoint for hosted redirect gateways (e.g. SSLCommerz).
   * Validates the transaction with the provider and redirects the browser
   * to the frontend success or failure page.
   */
  @Post('redirect/:provider/callback')
  async handleRedirectCallback(
    @Param('provider') provider: string,
    @Body() payload: Record<string, any>,
    @Res() res: Response,
  ) {
    const normalizedProvider = provider.toLowerCase().trim();
    if (
      normalizedProvider !== 'sslcommerz' &&
      normalizedProvider !== 'stripe'
    ) {
      throw new BadRequestException(
        `Unsupported redirect provider: ${provider}`,
      );
    }

    const result = await this.commandBus.execute(
      new HandleRedirectCallbackCommand(
        normalizedProvider as 'sslcommerz' | 'stripe',
        payload,
      ),
    );

    const frontendSuccessUrl =
      this.configService.get<string>('SSL_SUCCESS_FRONTEND_URL') ||
      'http://localhost:3000/payment/success';
    const frontendFailUrl =
      this.configService.get<string>('SSL_FAIL_FRONTEND_URL') ||
      'http://localhost:3000/payment/fail';
    const frontendCancelUrl =
      this.configService.get<string>('SSL_CANCEL_FRONTEND_URL') ||
      'http://localhost:3000/payment/cancel';

    if (result.success) {
      return res.redirect(
        `${frontendSuccessUrl}?order_id=${result.orderId}&transaction_id=${result.transactionId ?? ''}`,
      );
    }

    if (result.isCancelled) {
      return res.redirect(
        `${frontendCancelUrl}?order_id=${result.orderId}&reason=${encodeURIComponent(result.reason || 'Payment cancelled by customer')}`,
      );
    }

    return res.redirect(
      `${frontendFailUrl}?order_id=${result.orderId}&reason=${encodeURIComponent(result.reason || 'Payment failed')}`,
    );
  }

  /**
   * POST /api/payments/cancel
   * Manually cancel an active payment for an order.
   * Emits PaymentCancelledIntegrationEvent to notify the customer by email.
   */
  @Post('cancel')
  @HttpCode(HttpStatus.OK)
  @UseGuards(OptionalJwtAuthGuard)
  async cancelPayment(@Body() body: { orderId: string; reason?: string }) {
    if (!body?.orderId) {
      throw new BadRequestException('orderId is required in request body');
    }

    const result = await this.commandBus.execute(
      new CancelPaymentCommand(body.orderId, body.reason),
    );

    return { data: result };
  }

  /**
   * GET /api/payments/redirect/:provider/callback
   * In case gateways or browsers issue a GET redirect callback.
   */
  @Get('redirect/:provider/callback')
  async handleRedirectCallbackGet(
    @Param('provider') provider: string,
    @Query() query: Record<string, any>,
    @Res() res: Response,
  ) {
    return this.handleRedirectCallback(provider, query, res);
  }

  /**
   * GET /api/payments/order/:orderId
   * Retrieve current payment status and details for an order.
   */
  @Get('order/:orderId')
  @UseGuards(OptionalJwtAuthGuard)
  async getPaymentByOrderId(
    @Param('orderId', new ParseUUIDPipe()) orderId: string,
  ) {
    const result = await this.queryBus.execute(
      new GetPaymentByOrderIdQuery(orderId),
    );
    return { data: result };
  }
}
