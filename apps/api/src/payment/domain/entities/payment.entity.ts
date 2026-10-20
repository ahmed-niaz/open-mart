import { AggregateRoot } from '../../../shared/domain/aggregate-root.js';
import { DomainException } from '../../../shared/domain/exceptions/domain.exception.js';
import { Money } from '../../../shared/domain/value-objects/money.vo.js';
import { PaymentId } from '../value-objects/payment-id.vo.js';
import { PaymentProvider } from '../value-objects/payment-provider.vo.js';
import { PaymentStatus } from '../value-objects/payment-status.vo.js';
import { PaymentInitiatedEvent } from '../events/payment-initiated.event.js';
import { PaymentCompletedEvent } from '../events/payment-completed.event.js';
import { PaymentFailedEvent } from '../events/payment-failed.event.js';
import { PaymentCancelledEvent } from '../events/payment-cancelled.event.js';
import { PaymentNeedsReviewEvent } from '../events/payment-needs-review.event.js';

export interface PaymentProps {
  id: PaymentId;
  orderId: string;
  customerId: string | null;
  provider: PaymentProvider;
  status: PaymentStatus;
  amount: Money;
  transactionId: string | null;
  idempotencyKey: string | null;
  failureCode: string | null;
  failureReason: string | null;
  providerRefundId: string | null;
  refundedAmount: Money;
  paidAt: Date | null;
  metadata: Record<string, unknown> | null;
  version: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreatePaymentProps {
  id?: PaymentId;
  orderId: string;
  customerId?: string | null;
  provider: PaymentProvider;
  amount: Money;
  idempotencyKey?: string | null;
  transactionId?: string | null;
  metadata?: Record<string, unknown> | null;
}

export class Payment extends AggregateRoot {
  private readonly _id: PaymentId;
  private readonly _orderId: string;
  private readonly _customerId: string | null;
  private readonly _provider: PaymentProvider;
  private _status: PaymentStatus;
  private readonly _amount: Money;
  private _transactionId: string | null;
  private readonly _idempotencyKey: string | null;
  private _failureCode: string | null;
  private _failureReason: string | null;
  private _providerRefundId: string | null;
  private _refundedAmount: Money;
  private _paidAt: Date | null;
  private _metadata: Record<string, unknown> | null;
  private _version: number;
  private readonly _createdAt: Date;
  private _updatedAt: Date;

  private constructor(props: PaymentProps) {
    super();
    this._id = props.id;
    this._orderId = props.orderId;
    this._customerId = props.customerId;
    this._provider = props.provider;
    this._status = props.status;
    this._amount = props.amount;
    this._transactionId = props.transactionId;
    this._idempotencyKey = props.idempotencyKey;
    this._failureCode = props.failureCode;
    this._failureReason = props.failureReason;
    this._providerRefundId = props.providerRefundId;
    this._refundedAmount = props.refundedAmount;
    this._paidAt = props.paidAt;
    this._metadata = props.metadata;
    this._version = props.version;
    this._createdAt = props.createdAt;
    this._updatedAt = props.updatedAt;
  }

  static create(props: CreatePaymentProps): Payment {
    if (props.amount.toCents() <= 0) {
      throw new DomainException('Payment amount must be greater than zero');
    }

    const now = new Date();
    const id = props.id ?? PaymentId.generate();
    const zeroRefund = Money.zero(props.amount.getCurrency());

    const payment = new Payment({
      id,
      orderId: props.orderId,
      customerId: props.customerId ?? null,
      provider: props.provider,
      status: PaymentStatus.pending(),
      amount: props.amount,
      transactionId: props.transactionId ?? null,
      idempotencyKey: props.idempotencyKey ?? null,
      failureCode: null,
      failureReason: null,
      providerRefundId: null,
      refundedAmount: zeroRefund,
      paidAt: null,
      metadata: props.metadata ?? null,
      version: 1,
      createdAt: now,
      updatedAt: now,
    });

    payment.apply(
      new PaymentInitiatedEvent(
        id.getValue(),
        props.orderId,
        props.customerId ?? null,
        props.provider.getValue(),
        props.amount.toCents(),
        props.amount.getCurrency(),
        props.transactionId ?? null,
        now,
      ),
    );

    return payment;
  }

  static reconstitute(props: PaymentProps): Payment {
    return new Payment(props);
  }

  // ---------------------------------------------------------------------------
  // Domain State Transitions
  // ---------------------------------------------------------------------------

  assignTransactionId(transactionId: string): void {
    if (!transactionId || transactionId.trim().length === 0) {
      throw new DomainException('Transaction ID cannot be empty');
    }
    this._transactionId = transactionId.trim();
    this.touch();
  }

  updateMetadata(metadata: Record<string, unknown>): void {
    this._metadata = {
      ...this._metadata,
      ...metadata,
    };
    this.touch();
  }

  setProcessing(): void {
    this._status = this._status.transitionTo('processing');
    this.touch();
  }

  complete(transactionId?: string, paidAt?: Date): void {
    this._status = this._status.transitionTo('completed');
    if (transactionId) {
      this._transactionId = transactionId;
    }
    this._paidAt = paidAt ?? new Date();
    this.touch();

    this.apply(
      new PaymentCompletedEvent(
        this._id.getValue(),
        this._orderId,
        this._customerId,
        this._provider.getValue(),
        this._transactionId ?? this._id.getValue(),
        this._amount.toCents(),
        this._amount.getCurrency(),
        this._paidAt,
        new Date(),
      ),
    );
  }

  fail(reason: string, code?: string | null): void {
    this._status = this._status.transitionTo('failed');
    this._failureReason = reason;
    this._failureCode = code ?? null;
    this.touch();

    this.apply(
      new PaymentFailedEvent(
        this._id.getValue(),
        this._orderId,
        this._customerId,
        this._provider.getValue(),
        reason,
        code ?? null,
        new Date(),
      ),
    );
  }

  cancel(reason: string): void {
    this._status = this._status.transitionTo('cancelled');
    this._failureReason = reason;
    this.touch();

    this.apply(
      new PaymentCancelledEvent(
        this._id.getValue(),
        this._orderId,
        reason,
        new Date(),
      ),
    );
  }

  markNeedsReview(reason: string, receivedAmount: Money): void {
    this._status = this._status.transitionTo('needs_review');
    this._failureReason = reason;
    this.touch();

    this.apply(
      new PaymentNeedsReviewEvent(
        this._id.getValue(),
        this._orderId,
        this._provider.getValue(),
        reason,
        this._amount.toCents(),
        receivedAmount.toCents(),
        receivedAmount.getCurrency(),
        new Date(),
      ),
    );
  }

  refund(refundAmount: Money, providerRefundId: string): void {
    if (!this._status.isCompleted() && !this._status.isRefunded()) {
      throw new DomainException(
        `Cannot refund payment in '${this._status.getValue()}' status`,
      );
    }

    const newTotalRefunded = this._refundedAmount.add(refundAmount);
    if (newTotalRefunded.toCents() > this._amount.toCents()) {
      throw new DomainException(
        `Total refund amount (${newTotalRefunded.toCents()} cents) cannot exceed original payment amount (${this._amount.toCents()} cents)`,
      );
    }

    this._refundedAmount = newTotalRefunded;
    this._providerRefundId = providerRefundId;

    if (this._refundedAmount.toCents() === this._amount.toCents()) {
      this._status = this._status.transitionTo('refunded');
    } else {
      this._status = this._status.transitionTo('partially_refunded');
    }

    this.touch();
  }

  // ---------------------------------------------------------------------------
  // Concurrency & Metadata
  // ---------------------------------------------------------------------------

  incrementVersion(): void {
    this._version += 1;
    this._updatedAt = new Date();
  }

  private touch(): void {
    this._updatedAt = new Date();
  }

  // ---------------------------------------------------------------------------
  // Getters
  // ---------------------------------------------------------------------------

  get id(): PaymentId {
    return this._id;
  }

  get orderId(): string {
    return this._orderId;
  }

  get customerId(): string | null {
    return this._customerId;
  }

  get provider(): PaymentProvider {
    return this._provider;
  }

  get status(): PaymentStatus {
    return this._status;
  }

  get amount(): Money {
    return this._amount;
  }

  get transactionId(): string | null {
    return this._transactionId;
  }

  get idempotencyKey(): string | null {
    return this._idempotencyKey;
  }

  get failureCode(): string | null {
    return this._failureCode;
  }

  get failureReason(): string | null {
    return this._failureReason;
  }

  get providerRefundId(): string | null {
    return this._providerRefundId;
  }

  get refundedAmount(): Money {
    return this._refundedAmount;
  }

  get paidAt(): Date | null {
    return this._paidAt;
  }

  get metadata(): Record<string, unknown> | null {
    return this._metadata ? { ...this._metadata } : null;
  }

  get version(): number {
    return this._version;
  }

  get createdAt(): Date {
    return this._createdAt;
  }

  get updatedAt(): Date {
    return this._updatedAt;
  }
}
