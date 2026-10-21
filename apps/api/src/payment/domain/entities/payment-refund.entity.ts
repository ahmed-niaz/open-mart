import { DomainException } from '../../../shared/domain/exceptions/domain.exception.js';
import { Money } from '../../../shared/domain/value-objects/money.vo.js';

export type RefundStatus = 'pending' | 'completed' | 'failed';

export interface PaymentRefundProps {
  id: string;
  paymentId: string;
  orderId: string;
  amount: Money;
  reason: string;
  status: RefundStatus;
  gatewayRefundId: string | null;
  isOfflinePayout: boolean;
  offlineReference: string | null;
  failureReason: string | null;
  initiatedBy: string;
  createdAt: Date;
  completedAt: Date | null;
}

export interface CreatePaymentRefundProps {
  id?: string;
  paymentId: string;
  orderId: string;
  amount: Money;
  reason: string;
  initiatedBy: string;
  isOfflinePayout?: boolean;
  offlineReference?: string | null;
}

export class PaymentRefund {
  private readonly _id: string;
  private readonly _paymentId: string;
  private readonly _orderId: string;
  private readonly _amount: Money;
  private readonly _reason: string;
  private _status: RefundStatus;
  private _gatewayRefundId: string | null;
  private readonly _isOfflinePayout: boolean;
  private _offlineReference: string | null;
  private _failureReason: string | null;
  private readonly _initiatedBy: string;
  private readonly _createdAt: Date;
  private _completedAt: Date | null;

  private constructor(props: PaymentRefundProps) {
    this._id = props.id;
    this._paymentId = props.paymentId;
    this._orderId = props.orderId;
    this._amount = props.amount;
    this._reason = props.reason;
    this._status = props.status;
    this._gatewayRefundId = props.gatewayRefundId;
    this._isOfflinePayout = props.isOfflinePayout;
    this._offlineReference = props.offlineReference;
    this._failureReason = props.failureReason;
    this._initiatedBy = props.initiatedBy;
    this._createdAt = props.createdAt;
    this._completedAt = props.completedAt;
  }

  static create(props: CreatePaymentRefundProps): PaymentRefund {
    if (props.amount.toCents() <= 0) {
      throw new DomainException('Refund amount must be strictly positive');
    }
    if (!props.reason || props.reason.trim().length === 0) {
      throw new DomainException('Refund reason is required');
    }

    const now = new Date();
    return new PaymentRefund({
      id: props.id ?? crypto.randomUUID(),
      paymentId: props.paymentId,
      orderId: props.orderId,
      amount: props.amount,
      reason: props.reason.trim(),
      status: 'pending',
      gatewayRefundId: null,
      isOfflinePayout: props.isOfflinePayout ?? false,
      offlineReference: props.offlineReference ?? null,
      failureReason: null,
      initiatedBy: props.initiatedBy,
      createdAt: now,
      completedAt: null,
    });
  }

  static reconstitute(props: PaymentRefundProps): PaymentRefund {
    return new PaymentRefund(props);
  }

  complete(gatewayRefundId?: string | null): void {
    if (this._status === 'completed') {
      return;
    }
    this._status = 'completed';
    if (gatewayRefundId) {
      this._gatewayRefundId = gatewayRefundId;
    }
    this._completedAt = new Date();
  }

  fail(reason: string): void {
    this._status = 'failed';
    this._failureReason = reason;
  }

  get id(): string {
    return this._id;
  }

  get paymentId(): string {
    return this._paymentId;
  }

  get orderId(): string {
    return this._orderId;
  }

  get amount(): Money {
    return this._amount;
  }

  get reason(): string {
    return this._reason;
  }

  get status(): RefundStatus {
    return this._status;
  }

  get gatewayRefundId(): string | null {
    return this._gatewayRefundId;
  }

  get isOfflinePayout(): boolean {
    return this._isOfflinePayout;
  }

  get offlineReference(): string | null {
    return this._offlineReference;
  }

  get failureReason(): string | null {
    return this._failureReason;
  }

  get initiatedBy(): string {
    return this._initiatedBy;
  }

  get createdAt(): Date {
    return this._createdAt;
  }

  get completedAt(): Date | null {
    return this._completedAt;
  }
}
