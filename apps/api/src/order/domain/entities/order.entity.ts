import { AggregateRoot } from '../../../shared/domain/aggregate-root.js';
import { DomainException } from '../../../shared/domain/exceptions/domain.exception.js';
import { Money } from '../../../shared/domain/value-objects/money.vo.js';
import { OrderId } from '../value-objects/order-id.vo.js';
import { OrderStatus } from '../value-objects/order-status.vo.js';
import { ShippingAddress } from '../value-objects/shipping-address.vo.js';
import { OrderItem } from './order-item.entity.js';
import { OrderPlacedEvent } from '../events/order-placed.event.js';
import { OrderConfirmedEvent } from '../events/order-confirmed.event.js';
import { OrderShippedEvent } from '../events/order-shipped.event.js';
import { OrderDeliveredEvent } from '../events/order-delivered.event.js';
import { OrderCancelledEvent } from '../events/order-cancelled.event.js';

export interface OrderProps {
  id: OrderId;
  customerId: string | null;
  status: OrderStatus;
  items: OrderItem[];
  shippingAddress: ShippingAddress;
  courierName: string | null;
  trackingNumber: string | null;
  notes: string | null;
  shippedAt: Date | null;
  deliveredAt: Date | null;
  cancelledAt: Date | null;
  cancellationReason: string | null;
  version: number;
  createdAt: Date;
  updatedAt: Date;
}

export class Order extends AggregateRoot {
  private readonly _id: OrderId;
  private readonly _customerId: string | null;
  private _status: OrderStatus;
  private _items: OrderItem[];
  private readonly _shippingAddress: ShippingAddress;
  private _courierName: string | null;
  private _trackingNumber: string | null;
  private _notes: string | null;
  private _shippedAt: Date | null;
  private _deliveredAt: Date | null;
  private _cancelledAt: Date | null;
  private _cancellationReason: string | null;
  private _version: number;
  private readonly _createdAt: Date;
  private _updatedAt: Date;

  private constructor(props: OrderProps) {
    super();
    this._id = props.id;
    this._customerId = props.customerId;
    this._status = props.status;
    this._items = props.items;
    this._shippingAddress = props.shippingAddress;
    this._courierName = props.courierName;
    this._trackingNumber = props.trackingNumber;
    this._notes = props.notes;
    this._shippedAt = props.shippedAt;
    this._deliveredAt = props.deliveredAt;
    this._cancelledAt = props.cancelledAt;
    this._cancellationReason = props.cancellationReason;
    this._version = props.version;
    this._createdAt = props.createdAt;
    this._updatedAt = props.updatedAt;
  }

  static place(
    customerId: string | null,
    items: OrderItem[],
    shippingAddress: ShippingAddress,
    notes?: string | null,
  ): Order {
    if (!items || items.length === 0) {
      throw new DomainException('An order must contain at least one item');
    }

    const now = new Date();
    const id = OrderId.generate();

    const order = new Order({
      id,
      customerId,
      status: OrderStatus.pending(),
      items,
      shippingAddress,
      courierName: null,
      trackingNumber: null,
      notes: notes?.trim() || null,
      shippedAt: null,
      deliveredAt: null,
      cancelledAt: null,
      cancellationReason: null,
      version: 1,
      createdAt: now,
      updatedAt: now,
    });

    const total = order.getTotalAmount();
    const itemPayloads = items.map((i) => ({
      productId: i.productId,
      productName: i.productName,
      productSku: i.productSku,
      unitPriceAmount: i.unitPrice.toCents(),
      quantity: i.quantity,
    }));

    order.apply(
      new OrderPlacedEvent(
        id.getValue(),
        customerId,
        total.toCents(),
        total.getCurrency(),
        shippingAddress.toObject(),
        itemPayloads,
        now,
      ),
    );

    return order;
  }

  static reconstitute(props: OrderProps): Order {
    return new Order(props);
  }

  confirm(): void {
    this._status = this._status.confirm();
    this._updatedAt = new Date();

    const total = this.getTotalAmount();
    this.apply(
      new OrderConfirmedEvent(
        this._id.getValue(),
        this._customerId,
        total.toCents(),
        total.getCurrency(),
        this._shippingAddress.toObject(),
        this._updatedAt,
      ),
    );
  }

  process(): void {
    this._status = this._status.process();
    this._updatedAt = new Date();
  }

  ship(trackingNumber: string, courierName?: string | null): void {
    if (!trackingNumber || trackingNumber.trim().length === 0) {
      throw new DomainException('Tracking number is required to ship an order');
    }

    this._status = this._status.ship();
    this._trackingNumber = trackingNumber.trim();
    this._courierName = courierName?.trim() || null;
    this._shippedAt = new Date();
    this._updatedAt = new Date();

    this.apply(
      new OrderShippedEvent(
        this._id.getValue(),
        this._customerId,
        this._trackingNumber,
        this._courierName,
        this._updatedAt,
      ),
    );
  }

  deliver(): void {
    this._status = this._status.deliver();
    this._deliveredAt = new Date();
    this._updatedAt = new Date();

    this.apply(
      new OrderDeliveredEvent(
        this._id.getValue(),
        this._customerId,
        this._updatedAt,
      ),
    );
  }

  cancel(reason: string): void {
    if (!reason || reason.trim().length === 0) {
      throw new DomainException('A cancellation reason is required');
    }

    this._status = this._status.cancel();
    this._cancellationReason = reason.trim();
    this._cancelledAt = new Date();
    this._updatedAt = new Date();

    this.apply(
      new OrderCancelledEvent(
        this._id.getValue(),
        this._customerId,
        this._cancellationReason,
        this._updatedAt,
      ),
    );
  }

  returnOrder(reason?: string | null): void {
    this._status = this._status.returnOrder();
    this._cancellationReason = reason?.trim() || null;
    this._updatedAt = new Date();
  }

  getTotalAmount(): Money {
    if (this._items.length === 0) {
      return Money.zero('USD');
    }

    const currency = this._items[0].unitPrice.getCurrency();
    return this._items.reduce(
      (acc, item) => acc.add(item.getSubtotal()),
      Money.zero(currency),
    );
  }

  getItemCount(): number {
    return this._items.reduce((sum, item) => sum + item.quantity, 0);
  }

  get id(): OrderId {
    return this._id;
  }

  get customerId(): string | null {
    return this._customerId;
  }

  get status(): OrderStatus {
    return this._status;
  }

  get items(): OrderItem[] {
    return [...this._items];
  }

  get shippingAddress(): ShippingAddress {
    return this._shippingAddress;
  }

  get courierName(): string | null {
    return this._courierName;
  }

  get trackingNumber(): string | null {
    return this._trackingNumber;
  }

  get notes(): string | null {
    return this._notes;
  }

  get shippedAt(): Date | null {
    return this._shippedAt;
  }

  get deliveredAt(): Date | null {
    return this._deliveredAt;
  }

  get cancelledAt(): Date | null {
    return this._cancelledAt;
  }

  get cancellationReason(): string | null {
    return this._cancellationReason;
  }

  get version(): number {
    return this._version;
  }

  incrementVersion(): void {
    this._version += 1;
  }

  get createdAt(): Date {
    return this._createdAt;
  }

  get updatedAt(): Date {
    return this._updatedAt;
  }
}
