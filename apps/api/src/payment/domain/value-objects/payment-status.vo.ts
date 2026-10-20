import { DomainException } from '../../../shared/domain/exceptions/domain.exception.js';

export const PAYMENT_TXN_STATUSES = [
  'pending',
  'processing',
  'completed',
  'failed',
  'cancelled',
  'needs_review',
  'refunded',
  'partially_refunded',
] as const;

export type PaymentTxnStatusValue = (typeof PAYMENT_TXN_STATUSES)[number];

const ALLOWED_TRANSITIONS: Record<
  PaymentTxnStatusValue,
  readonly PaymentTxnStatusValue[]
> = {
  pending: ['processing', 'completed', 'failed', 'cancelled', 'needs_review'],
  processing: ['completed', 'failed', 'cancelled', 'needs_review'],
  completed: ['refunded', 'partially_refunded'],
  failed: [],
  cancelled: [],
  needs_review: ['completed', 'refunded', 'cancelled'],
  refunded: [],
  partially_refunded: ['refunded', 'partially_refunded'],
};

export class PaymentStatus {
  private readonly value: PaymentTxnStatusValue;

  private constructor(value: PaymentTxnStatusValue) {
    this.value = value;
  }

  static fromString(value: string): PaymentStatus {
    const normalized = value.toLowerCase().trim() as PaymentTxnStatusValue;
    if (!PAYMENT_TXN_STATUSES.includes(normalized)) {
      throw new DomainException(
        `Invalid payment status '${value}'. Allowed statuses: ${PAYMENT_TXN_STATUSES.join(', ')}`,
      );
    }
    return new PaymentStatus(normalized);
  }

  static pending(): PaymentStatus {
    return new PaymentStatus('pending');
  }

  static processing(): PaymentStatus {
    return new PaymentStatus('processing');
  }

  static completed(): PaymentStatus {
    return new PaymentStatus('completed');
  }

  static failed(): PaymentStatus {
    return new PaymentStatus('failed');
  }

  static cancelled(): PaymentStatus {
    return new PaymentStatus('cancelled');
  }

  static needsReview(): PaymentStatus {
    return new PaymentStatus('needs_review');
  }

  static refunded(): PaymentStatus {
    return new PaymentStatus('refunded');
  }

  static partiallyRefunded(): PaymentStatus {
    return new PaymentStatus('partially_refunded');
  }

  getValue(): PaymentTxnStatusValue {
    return this.value;
  }

  canTransitionTo(target: PaymentTxnStatusValue): boolean {
    return ALLOWED_TRANSITIONS[this.value].includes(target);
  }

  transitionTo(target: PaymentTxnStatusValue): PaymentStatus {
    if (!this.canTransitionTo(target)) {
      throw new DomainException(
        `Cannot transition payment status from '${this.value}' to '${target}'`,
      );
    }
    return new PaymentStatus(target);
  }

  isPending(): boolean {
    return this.value === 'pending';
  }

  isProcessing(): boolean {
    return this.value === 'processing';
  }

  isCompleted(): boolean {
    return this.value === 'completed';
  }

  isFailed(): boolean {
    return this.value === 'failed';
  }

  isCancelled(): boolean {
    return this.value === 'cancelled';
  }

  isNeedsReview(): boolean {
    return this.value === 'needs_review';
  }

  isRefunded(): boolean {
    return this.value === 'refunded' || this.value === 'partially_refunded';
  }

  isTerminal(): boolean {
    return ALLOWED_TRANSITIONS[this.value].length === 0;
  }

  equals(other: PaymentStatus): boolean {
    return this.value === other.value;
  }

  toString(): string {
    return this.value;
  }
}

