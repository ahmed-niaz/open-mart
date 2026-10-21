import { Money } from '../../../shared/domain/value-objects/money.vo.js';

export interface GenericWebhookRequest {
  provider: 'stripe' | 'cod' | 'sslcommerz';
  rawBody?: Buffer | string;
  headers: Record<string, string | string[] | undefined>;
  query: Record<string, any>;
  body: Record<string, any>;
}

export interface InitiatePaymentInput {
  paymentId: string;
  orderId: string;
  orderNumber?: string;
  amount: Money; // in minor currency units (cents for USD)
  customerEmail: string;
  customerName?: string;
  customerPhone?: string;
  shippingAddress?: {
    recipientName?: string;
    recipientPhone?: string;
    addressLine: string;
    city: string;
    district: string;
    division?: string;
    postalCode?: string | null;
  };
  idempotencyKey?: string;
}

export interface InitiatePaymentResult {
  transactionId: string; // Gateway transaction reference / session ID
  checkoutUrl?: string; // Hosted checkout redirect URL
  clientSecret?: string; // Optional client secret for embedded UI components
  provider: 'stripe' | 'cod' | 'sslcommerz';
  metadata?: Record<string, unknown>;
}

export interface WebhookVerificationResult {
  eventType: 'payment.succeeded' | 'payment.failed' | 'payment.cancelled';
  transactionId: string;
  orderId: string;
  amount: Money;
  failureReason?: string;
  failureCode?: string;
  gatewayPayload: Record<string, unknown>;
}

export interface GatewayRefundResult {
  refundId: string;
  status: 'completed' | 'pending' | 'failed';
  failureReason?: string;
  isOfflinePayout?: boolean;
}

export interface PaymentGatewayStrategy {
  getProviderName(): 'stripe' | 'cod' | 'sslcommerz';
  initiatePayment(input: InitiatePaymentInput): Promise<InitiatePaymentResult>;
  verifyAndParseWebhook(
    request: GenericWebhookRequest,
  ): Promise<WebhookVerificationResult>;
  validateRedirect?(
    payload: Record<string, any>,
  ): Promise<WebhookVerificationResult>;
  refund?(
    transactionId: string,
    amount: Money,
    reason?: string,
    idempotencyKey?: string,
    metadata?: Record<string, unknown>,
  ): Promise<GatewayRefundResult>;
}
