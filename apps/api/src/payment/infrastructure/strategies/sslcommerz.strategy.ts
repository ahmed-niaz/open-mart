import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

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

interface SslSessionResponse {
  status: string;
  failedreason?: string;
  sessionkey?: string;
  GatewayPageURL?: string;
  redirectGatewayURL?: string;
}

interface SslValidationResponse {
  status: string;
  tran_date?: string;
  tran_id?: string;
  val_id?: string;
  amount?: string;
  currency?: string;
  value_a?: string; // orderId
  value_b?: string; // paymentId
  error?: string;
}

@Injectable()
export class SslCommerzPaymentStrategy implements PaymentGatewayStrategy {
  private readonly logger = new Logger(SslCommerzPaymentStrategy.name);
  private readonly storeId: string;
  private readonly storePass: string;
  private readonly paymentApi: string;
  private readonly validationApi: string;
  private readonly refundApi: string;
  private readonly successUrl: string;
  private readonly failUrl: string;
  private readonly cancelUrl: string;
  private readonly ipnUrl: string;

  constructor(private readonly configService: ConfigService) {
    this.storeId = this.configService.get<string>('SSL_STORE_ID') || '';
    this.storePass = this.configService.get<string>('SSL_STORE_PASS') || '';
    this.paymentApi =
      this.configService.get<string>('SSL_PAYMENT_API') ||
      'https://sandbox.sslcommerz.com/gwprocess/v4/api.php';
    this.validationApi =
      this.configService.get<string>('SSL_VALIDATION_API') ||
      'https://sandbox.sslcommerz.com/validator/api/validationserverAPI.php';
    this.refundApi =
      this.configService.get<string>('SSL_REFUND_API') ||
      'https://sandbox.sslcommerz.com/validator/api/merchantTransIDvalidationAPI.php';

    this.successUrl =
      this.configService.get<string>('SSL_SUCCESS_BACKEND_URL')?.trim() ||
      'http://localhost:3001/api/payments/redirect/sslcommerz/callback';
    this.failUrl =
      this.configService.get<string>('SSL_FAIL_BACKEND_URL')?.trim() ||
      'http://localhost:3001/api/payments/redirect/sslcommerz/callback';
    this.cancelUrl =
      this.configService.get<string>('SSL_CANCEL_BACKEND_URL')?.trim() ||
      'http://localhost:3001/api/payments/redirect/sslcommerz/callback';
    this.ipnUrl =
      this.configService.get<string>('SSL_IPN_URL')?.trim() ||
      'http://localhost:3001/api/payments/webhook/sslcommerz';
  }

  getProviderName(): 'sslcommerz' {
    return 'sslcommerz';
  }

  async initiatePayment(
    input: InitiatePaymentInput,
  ): Promise<InitiatePaymentResult> {
    const amountInDecimal = (input.amount.toCents() / 100).toFixed(2);

    const formData = new URLSearchParams({
      store_id: this.storeId,
      store_passwd: this.storePass,
      total_amount: amountInDecimal,
      currency: input.amount.getCurrency(),
      tran_id: input.paymentId,
      success_url: this.successUrl,
      fail_url: this.failUrl,
      cancel_url: this.cancelUrl,
      ipn_url: this.ipnUrl,
      shipping_method: 'NO',
      product_name: input.orderNumber
        ? `Order #${input.orderNumber}`
        : `Order ${input.orderId}`,
      product_category: 'General',
      product_profile: 'general',
      cus_name: input.customerName || 'Valued Customer',
      cus_email: input.customerEmail,
      cus_add1: input.shippingAddress?.addressLine || 'Address Line 1',
      cus_city: input.shippingAddress?.city || 'Dhaka',
      cus_state: input.shippingAddress?.division || 'Dhaka',
      cus_postcode: input.shippingAddress?.postalCode || '1200',
      cus_country: 'Bangladesh',
      cus_phone: input.customerPhone || '01700000000',
      value_a: input.orderId,
      value_b: input.paymentId,
    });

    try {
      this.logger.log(
        `Initiating SSLCommerz hosted checkout for payment ${input.paymentId} (Order ${input.orderId})`,
      );

      const res = await fetch(this.paymentApi, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: formData.toString(),
      });

      const data = (await res.json()) as SslSessionResponse;

      if (data.status !== 'SUCCESS' || !data.GatewayPageURL) {
        throw new ApplicationException(
          `SSLCommerz session initialization failed: ${data.failedreason || 'Unknown error'}`,
          ApplicationExceptionCode.INTERNAL_SERVER_ERROR,
        );
      }

      return {
        transactionId: data.sessionkey || input.paymentId,
        checkoutUrl: data.GatewayPageURL,
        provider: 'sslcommerz',
        metadata: {
          sessionkey: data.sessionkey,
          tran_id: input.paymentId,
        },
      };
    } catch (err: any) {
      if (err instanceof ApplicationException) {
        throw err;
      }
      this.logger.error(`SSLCommerz HTTP error: ${err.message}`, err.stack);
      throw new ApplicationException(
        `SSLCommerz gateway communication error: ${err.message}`,
        ApplicationExceptionCode.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async verifyAndParseWebhook(
    request: GenericWebhookRequest,
  ): Promise<WebhookVerificationResult> {
    const payload = request.body || {};
    const valId = payload.val_id || request.query?.val_id;

    if (!valId) {
      throw new ApplicationException(
        'Missing val_id in SSLCommerz IPN payload',
        ApplicationExceptionCode.VALIDATION_ERROR,
      );
    }

    return this.validateWithServer(valId, payload);
  }

  async validateRedirect(
    payload: Record<string, any>,
  ): Promise<WebhookVerificationResult> {
    const valId = payload.val_id;
    if (valId) {
      return this.validateWithServer(valId, payload);
    }

    const normalizedStatus = (payload.status || '').toUpperCase();
    const orderId = payload.value_a || payload.order_id || '';
    const amountNumber = parseFloat(
      payload.amount || payload.currency_amount || '0',
    );
    const currency = (
      payload.currency ||
      payload.currency_type ||
      'USD'
    ).toUpperCase();
    const transactionId =
      payload.tran_id || payload.sessionkey || payload.bank_tran_id || '';

    // Success fallback
    if (normalizedStatus === 'VALID' || normalizedStatus === 'VALIDATED') {
      return {
        eventType: 'payment.succeeded',
        transactionId: transactionId || 'SSL-SUCCESS',
        orderId,
        amount: Money.create(amountNumber, currency),
        gatewayPayload: payload,
      };
    }

    // Cancellation
    if (normalizedStatus === 'CANCELLED' || normalizedStatus === 'CANCEL') {
      return {
        eventType: 'payment.cancelled',
        transactionId,
        orderId,
        amount: Money.create(amountNumber, currency),
        failureReason:
          payload.failedreason ||
          payload.error ||
          'Payment cancelled by customer',
        gatewayPayload: payload,
      };
    }

    // Failure
    if (normalizedStatus === 'FAILED' || normalizedStatus === 'FAIL') {
      return {
        eventType: 'payment.failed',
        transactionId,
        orderId,
        amount: Money.create(amountNumber, currency),
        failureReason:
          payload.failedreason ||
          payload.error ||
          'Payment failed on SSLCommerz',
        gatewayPayload: payload,
      };
    }

    throw new ApplicationException(
      `Unhandled SSLCommerz redirect status: ${payload.status || 'unknown'}`,
      ApplicationExceptionCode.VALIDATION_ERROR,
    );
  }

  private async validateWithServer(
    valId: string,
    rawPayload: Record<string, any>,
  ): Promise<WebhookVerificationResult> {
    const validationUrl = `${this.validationApi}?val_id=${encodeURIComponent(
      valId,
    )}&store_id=${encodeURIComponent(this.storeId)}&store_passwd=${encodeURIComponent(
      this.storePass,
    )}&v=1&format=json`;

    try {
      const res = await fetch(validationUrl);
      const data = (await res.json()) as SslValidationResponse;

      const isValid = data.status === 'VALID' || data.status === 'VALIDATED';
      const isCancelled =
        data.status === 'CANCELLED' || data.status === 'CANCEL';
      const orderId = data.value_a || (rawPayload.value_a as string) || '';
      const amountNumber = parseFloat(data.amount || '0');
      const currency = (data.currency || 'USD').toUpperCase();

      let eventType:
        'payment.succeeded' | 'payment.failed' | 'payment.cancelled' =
        'payment.failed';
      if (isValid) {
        eventType = 'payment.succeeded';
      } else if (isCancelled) {
        eventType = 'payment.cancelled';
      }

      return {
        eventType,
        transactionId: data.val_id || valId,
        orderId,
        amount: Money.create(amountNumber, currency),
        failureReason: isValid
          ? undefined
          : data.error || `SSLCommerz status: ${data.status}`,
        gatewayPayload: {
          ...rawPayload,
          validationResponse: data,
        },
      };
    } catch (err: any) {
      this.logger.error(
        `SSLCommerz validation failed: ${err.message}`,
        err.stack,
      );
      throw new ApplicationException(
        `Failed to validate SSLCommerz transaction: ${err.message}`,
        ApplicationExceptionCode.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async refund(
    transactionId: string,
    amount: Money,
    reason?: string,
    _idempotencyKey?: string,
    _metadata?: Record<string, unknown>,
  ): Promise<GatewayRefundResult> {
    const refundAmount = (amount.toCents() / 100).toFixed(2);
    const refundUrl = `${this.refundApi}?refund_amount=${encodeURIComponent(
      refundAmount,
    )}&refund_remarks=${encodeURIComponent(
      reason || 'Customer refund',
    )}&bank_tran_id=${encodeURIComponent(
      transactionId,
    )}&store_id=${encodeURIComponent(this.storeId)}&store_passwd=${encodeURIComponent(
      this.storePass,
    )}&v=1&format=json`;

    try {
      if (!this.storeId || !this.storePass) {
        return {
          refundId: `SSL-REF-${Date.now()}`,
          status: 'completed',
        };
      }

      const res = await fetch(refundUrl);
      const data = (await res.json()) as any;

      if (data.status === 'success') {
        return {
          refundId: data.refund_ref_id || `SSL-REF-${Date.now()}`,
          status: 'completed',
        };
      } else if (data.status === 'processing') {
        return {
          refundId: data.refund_ref_id || `SSL-REF-${Date.now()}`,
          status: 'pending',
        };
      } else {
        return {
          refundId: '',
          status: 'failed',
          failureReason:
            data.errorReason || `SSLCommerz refund status: ${data.status}`,
        };
      }
    } catch (err: any) {
      this.logger.error(`SSLCommerz refund failed: ${err.message}`, err.stack);
      return {
        refundId: '',
        status: 'failed',
        failureReason: err.message,
      };
    }
  }
}
