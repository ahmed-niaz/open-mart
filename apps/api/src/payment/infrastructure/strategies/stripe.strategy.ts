import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';

import {
  GatewayRefundResult,
  GenericWebhookRequest,
  InitiatePaymentInput,
  InitiatePaymentResult,
  PaymentGatewayStrategy,
  WebhookVerificationResult,
} from '../../application/ports/payment-gateway-strategy.port.js';
import { Money } from '../../../shared/domain/value-objects/money.vo.js';
import {
  ApplicationException,
  ApplicationExceptionCode,
} from '../../../shared/domain/exceptions/application.exception.js';

@Injectable()
export class StripePaymentStrategy implements PaymentGatewayStrategy {
  private readonly logger = new Logger(StripePaymentStrategy.name);
  private readonly stripe: Stripe;
  private readonly webhookSecret: string;
  private readonly successUrl: string;
  private readonly cancelUrl: string;
  private readonly apiBaseUrl: string;

  constructor(private readonly configService: ConfigService) {
    const secretKey = this.configService.get<string>('STRIPE_SECRET_KEY');
    if (!secretKey) {
      this.logger.warn('STRIPE_SECRET_KEY is not defined in configuration');
    }
    this.stripe = new Stripe(secretKey || '', {
      apiVersion: '2026-09-30.endive',
    });

    this.webhookSecret =
      this.configService.get<string>('STRIPE_WEBHOOK_SECRET') || '';

    const frontendUrl =
      this.configService.get<string>('FRONTEND_URL') || 'http://localhost:3000';
    this.apiBaseUrl =
      this.configService.get<string>('API_BASE_URL') || 'http://localhost:3001';
    this.successUrl =
      this.configService.get<string>('STRIPE_SUCCESS_URL') ||
      `${frontendUrl}/payment/success`;
    this.cancelUrl =
      this.configService.get<string>('STRIPE_CANCEL_URL') ||
      `${frontendUrl}/payment/cancel`;
  }

  getProviderName(): 'stripe' {
    return 'stripe';
  }

  async initiatePayment(
    input: InitiatePaymentInput,
  ): Promise<InitiatePaymentResult> {
    try {
      const session = await this.stripe.checkout.sessions.create(
        {
          mode: 'payment',
          customer_email: input.customerEmail,
          line_items: [
            {
              price_data: {
                currency: input.amount.getCurrency().toLowerCase(), // 'usd'
                unit_amount: input.amount.toCents(), // minor units / cents
                product_data: {
                  name: input.orderNumber
                    ? `Order #${input.orderNumber}`
                    : `Order ${input.orderId}`,
                  description: `Open-Mart Purchase (Order: ${input.orderId})`,
                },
              },
              quantity: 1,
            },
          ],
          client_reference_id: input.orderId,
          metadata: {
            orderId: input.orderId,
            paymentId: input.paymentId,
          },
          success_url: `${this.apiBaseUrl}/api/payments/stripe/verify-session?session_id={CHECKOUT_SESSION_ID}&order_id=${input.orderId}`,
          cancel_url: `${this.apiBaseUrl}/api/payments/stripe/cancel?order_id=${input.orderId}`,
        },
        input.idempotencyKey
          ? { idempotencyKey: input.idempotencyKey }
          : undefined,
      );

      return {
        transactionId: session.id,
        checkoutUrl: session.url ?? undefined,
        clientSecret: session.client_secret ?? undefined,
        provider: 'stripe',
        metadata: {
          sessionId: session.id,
          paymentIntentId:
            typeof session.payment_intent === 'string'
              ? session.payment_intent
              : undefined,
        },
      };
    } catch (error: any) {
      this.logger.error(
        `Stripe initiatePayment failed: ${error.message}`,
        error.stack,
      );
      throw new ApplicationException(
        `Stripe session creation failed: ${error.message}`,
        ApplicationExceptionCode.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async verifyAndParseWebhook(
    request: GenericWebhookRequest,
  ): Promise<WebhookVerificationResult> {
    const rawSig =
      request.headers['stripe-signature'] ||
      (request.headers['Stripe-Signature'] as string | undefined);
    const signature = Array.isArray(rawSig) ? rawSig[0] : rawSig;

    if (!signature) {
      throw new ApplicationException(
        'Missing stripe-signature header in Stripe webhook payload',
        ApplicationExceptionCode.UNAUTHORIZED,
      );
    }

    if (!request.rawBody) {
      throw new ApplicationException(
        'Missing rawBody for Stripe webhook signature verification. Ensure rawBody is enabled in main.ts',
        ApplicationExceptionCode.VALIDATION_ERROR,
      );
    }

    let event: Stripe.Event;
    try {
      event = this.stripe.webhooks.constructEvent(
        request.rawBody,
        signature,
        this.webhookSecret,
      );
    } catch (err: any) {
      this.logger.error(`Stripe signature verification failed: ${err.message}`);
      throw new ApplicationException(
        `Webhook signature verification failed: ${err.message}`,
        ApplicationExceptionCode.UNAUTHORIZED,
      );
    }

    this.logger.log(`Received Stripe event: ${event.type} [${event.id}]`);

    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        const orderId =
          (session.metadata?.orderId as string) ||
          session.client_reference_id ||
          '';

        const amountCents = session.amount_total ?? 0;
        const currency = (session.currency ?? 'usd').toUpperCase();

        return {
          eventType:
            session.payment_status === 'paid'
              ? 'payment.succeeded'
              : 'payment.failed',
          transactionId:
            typeof session.payment_intent === 'string'
              ? session.payment_intent
              : session.id,
          orderId,
          amount: Money.fromCents(amountCents, currency),
          gatewayPayload: event as unknown as Record<string, unknown>,
        };
      }

      case 'payment_intent.succeeded': {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        const orderId = (paymentIntent.metadata?.orderId as string) || '';

        return {
          eventType: 'payment.succeeded',
          transactionId: paymentIntent.id,
          orderId,
          amount: Money.fromCents(
            paymentIntent.amount_received ?? paymentIntent.amount,
            (paymentIntent.currency ?? 'usd').toUpperCase(),
          ),
          gatewayPayload: event as unknown as Record<string, unknown>,
        };
      }

      case 'payment_intent.payment_failed': {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        const orderId = (paymentIntent.metadata?.orderId as string) || '';
        const failureReason =
          paymentIntent.last_payment_error?.message ||
          'Stripe PaymentIntent payment failed';
        const failureCode = paymentIntent.last_payment_error?.code;

        return {
          eventType: 'payment.failed',
          transactionId: paymentIntent.id,
          orderId,
          amount: Money.fromCents(
            paymentIntent.amount,
            (paymentIntent.currency ?? 'usd').toUpperCase(),
          ),
          failureReason,
          failureCode,
          gatewayPayload: event as unknown as Record<string, unknown>,
        };
      }

      case 'payment_intent.canceled':
      case 'checkout.session.expired': {
        const sessionOrIntent = event.data.object as any;
        const orderId =
          (sessionOrIntent.metadata?.orderId as string) ||
          sessionOrIntent.client_reference_id ||
          '';

        return {
          eventType: 'payment.cancelled',
          transactionId: sessionOrIntent.id,
          orderId,
          amount: Money.zero((sessionOrIntent.currency ?? 'usd').toUpperCase()),
          failureReason:
            event.type === 'checkout.session.expired'
              ? 'Checkout session expired'
              : 'Payment was cancelled in Stripe',
          gatewayPayload: event as unknown as Record<string, unknown>,
        };
      }

      default: {
        // Return default failed/unhandled result without throwing, so webhook returns 200
        return {
          eventType: 'payment.failed',
          transactionId: event.id,
          orderId: (event.data.object as any)?.metadata?.orderId || '',
          amount: Money.zero('USD'),
          failureReason: `Unhandled event type: ${event.type}`,
          gatewayPayload: event as unknown as Record<string, unknown>,
        };
      }
    }
  }

  /**
   * Retrieve a Stripe Checkout Session directly from the API.
   * Used by the verify-session flow to confirm payment status when
   * webhooks haven't arrived yet (common in local dev).
   */
  async retrieveSession(
    sessionId: string,
  ): Promise<Stripe.Checkout.Session | null> {
    try {
      return await this.stripe.checkout.sessions.retrieve(sessionId);
    } catch (err: any) {
      this.logger.error(`Stripe session retrieval failed: ${err.message}`);
      return null;
    }
  }

  async refund(
    transactionId: string,
    amount: Money,
    reason?: string,
    idempotencyKey?: string,
    metadata?: Record<string, unknown>,
  ): Promise<GatewayRefundResult> {
    try {
      let paymentIntentId = transactionId;
      if (
        metadata?.paymentIntentId &&
        typeof metadata.paymentIntentId === 'string'
      ) {
        paymentIntentId = metadata.paymentIntentId;
      } else if (transactionId.startsWith('cs_')) {
        const session = await this.retrieveSession(transactionId);
        if (session && typeof session.payment_intent === 'string') {
          paymentIntentId = session.payment_intent;
        }
      }

      const refund = await this.stripe.refunds.create(
        {
          payment_intent: paymentIntentId,
          amount: amount.toCents(),
          reason:
            (reason as Stripe.RefundCreateParams.Reason) ||
            'requested_by_customer',
        },
        idempotencyKey ? { idempotencyKey } : undefined,
      );

      let status: 'completed' | 'pending' | 'failed' = 'pending';
      if (refund.status === 'succeeded') {
        status = 'completed';
      } else if (refund.status === 'failed' || refund.status === 'canceled') {
        status = 'failed';
      }

      return {
        refundId: refund.id,
        status,
        failureReason: refund.failure_reason ?? undefined,
      };
    } catch (err: any) {
      this.logger.error(`Stripe refund failed: ${err.message}`, err.stack);
      return {
        refundId: '',
        status: 'failed',
        failureReason: err.message,
      };
    }
  }
}
