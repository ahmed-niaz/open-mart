import { Payment } from '../../domain/entities/payment.entity.js';
import { PaymentRefund } from '../../domain/entities/payment-refund.entity.js';
import { PaymentId } from '../../domain/value-objects/payment-id.vo.js';

export const PAYMENT_REPOSITORY = Symbol('PAYMENT_REPOSITORY');

export interface PaymentRepositoryPort {
  save(payment: Payment): Promise<void>;
  findById(id: PaymentId): Promise<Payment | null>;
  findByOrderId(orderId: string): Promise<Payment | null>;
  findByTransactionId(transactionId: string): Promise<Payment | null>;
  findRefundsByPaymentId(paymentId: PaymentId): Promise<PaymentRefund[]>;
  findRefundsByOrderId(orderId: string): Promise<PaymentRefund[]>;
  /**
   * Atomically claims a webhook event in the idempotency ledger.
   * If the event was already recorded (conflict on provider + eventId), returns false.
   * If recorded successfully, executes the callback within the same database transaction.
   */
  processWebhookEventAtomic(
    event: {
      provider: 'stripe' | 'cod' | 'sslcommerz';
      eventId: string;
      eventType: string;
      payloadHash?: string;
    },
    action: (txRepo: PaymentRepositoryPort) => Promise<void>,
  ): Promise<boolean>;
}
