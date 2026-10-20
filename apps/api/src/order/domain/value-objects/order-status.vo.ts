import { DomainException } from '../../../shared/domain/exceptions/domain.exception.js';

export const ORDER_STATUSES = [
  'pending',
  'confirmed',
  'processing',
  'shipped',
  'delivered',
  'cancelled',
  'returned',
] as const;

export type OrderStatusValue = (typeof ORDER_STATUSES)[number];

const ALLOWED_TRANSITIONS: Record<
  OrderStatusValue,
  readonly OrderStatusValue[]
> = {
  pending: ['confirmed', 'cancelled'],
  confirmed: ['processing', 'cancelled'],
  processing: ['shipped', 'cancelled'],
  shipped: ['delivered', 'returned'],
  delivered: [],
  cancelled: [],
  returned: [],
};

export class OrderStatus {
  private readonly value: OrderStatusValue;

  private constructor(value: OrderStatusValue) {
    this.value = value;
  }

  static pending(): OrderStatus {
    return new OrderStatus('pending');
  }

  static confirmed(): OrderStatus {
    return new OrderStatus('confirmed');
  }

  static processing(): OrderStatus {
    return new OrderStatus('processing');
  }

  static shipped(): OrderStatus {
    return new OrderStatus('shipped');
  }

  static delivered(): OrderStatus {
    return new OrderStatus('delivered');
  }

  static cancelled(): OrderStatus {
    return new OrderStatus('cancelled');
  }

  static returned(): OrderStatus {
    return new OrderStatus('returned');
  }

  static fromString(value: string): OrderStatus {
    const normalized = value.toLowerCase() as OrderStatusValue;
    if (!ORDER_STATUSES.includes(normalized)) {
      throw new DomainException(`Invalid order status: '${value}'`);
    }
    return new OrderStatus(normalized);
  }

  canTransitionTo(next: OrderStatusValue): boolean {
    return ALLOWED_TRANSITIONS[this.value].includes(next);
  }

  private ensureTransition(target: OrderStatusValue, actionName: string): void {
    if (!this.canTransitionTo(target)) {
      throw new DomainException(
        `Cannot ${actionName} order: Transition from '${this.value}' to '${target}' is not allowed.`,
      );
    }
  }

  confirm(): OrderStatus {
    this.ensureTransition('confirmed', 'confirm');
    return OrderStatus.confirmed();
  }

  process(): OrderStatus {
    this.ensureTransition('processing', 'process');
    return OrderStatus.processing();
  }

  ship(): OrderStatus {
    this.ensureTransition('shipped', 'ship');
    return OrderStatus.shipped();
  }

  deliver(): OrderStatus {
    this.ensureTransition('delivered', 'deliver');
    return OrderStatus.delivered();
  }

  cancel(): OrderStatus {
    this.ensureTransition('cancelled', 'cancel');
    return OrderStatus.cancelled();
  }

  returnOrder(): OrderStatus {
    this.ensureTransition('returned', 'return');
    return OrderStatus.returned();
  }

  getValue(): OrderStatusValue {
    return this.value;
  }

  isPending(): boolean {
    return this.value === 'pending';
  }

  isConfirmed(): boolean {
    return this.value === 'confirmed';
  }

  isProcessing(): boolean {
    return this.value === 'processing';
  }

  isShipped(): boolean {
    return this.value === 'shipped';
  }

  isDelivered(): boolean {
    return this.value === 'delivered';
  }

  isCancelled(): boolean {
    return this.value === 'cancelled';
  }

  isReturned(): boolean {
    return this.value === 'returned';
  }

  equals(other: OrderStatus): boolean {
    return this.value === other.value;
  }
}
