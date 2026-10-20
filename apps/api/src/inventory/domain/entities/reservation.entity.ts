import { AggregateRoot } from '../../../shared/domain/aggregate-root.js';
import { Sku } from '../value-objects/sku.vo.js';
import { Quantity } from '../value-objects/quantity.vo.js';
import { ReservationConflictException } from '../exceptions/reservation-conflict.exception.js';
import { StockReservedEvent } from '../events/stock-reserved.event.js';
import { StockCommittedEvent } from '../events/stock-committed.event.js';
import { StockReleasedEvent } from '../events/stock-released.event.js';
import { StockReversedEvent } from '../events/stock-reversed.event.js';
import { ReservationExpiredEvent } from '../events/reservation-expired.event.js';

export type ReservationStatus =
  'reserved' | 'committed' | 'released' | 'expired' | 'reversed';

export interface ReservationProps {
  id: string;
  orderId: string;
  inventoryItemId: string;
  sku: Sku;
  quantity: Quantity;
  status: ReservationStatus;
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateReservationProps {
  id?: string;
  orderId: string;
  inventoryItemId: string;
  sku: string;
  quantity: number;
  ttlMinutes?: number;
}

export class Reservation extends AggregateRoot {
  private readonly _id: string;
  private readonly _orderId: string;
  private readonly _inventoryItemId: string;
  private readonly _sku: Sku;
  private readonly _quantity: Quantity;
  private _status: ReservationStatus;
  private readonly _expiresAt: Date;
  private readonly _createdAt: Date;
  private _updatedAt: Date;

  private constructor(props: ReservationProps) {
    super();
    this._id = props.id;
    this._orderId = props.orderId;
    this._inventoryItemId = props.inventoryItemId;
    this._sku = props.sku;
    this._quantity = props.quantity;
    this._status = props.status;
    this._expiresAt = props.expiresAt;
    this._createdAt = props.createdAt;
    this._updatedAt = props.updatedAt;
  }

  static create(props: CreateReservationProps): Reservation {
    const sku = Sku.create(props.sku);
    const quantity = Quantity.create(props.quantity);
    const now = new Date();
    const ttlMinutes = props.ttlMinutes ?? 30;
    const expiresAt = new Date(now.getTime() + ttlMinutes * 60 * 1000);

    const reservation = new Reservation({
      id: props.id ?? crypto.randomUUID(),
      orderId: props.orderId,
      inventoryItemId: props.inventoryItemId,
      sku,
      quantity,
      status: 'reserved',
      expiresAt,
      createdAt: now,
      updatedAt: now,
    });

    reservation.apply(
      new StockReservedEvent(
        props.orderId,
        sku.getValue(),
        quantity.getValue(),
        0, // remaining computed at persistence
        now,
      ),
    );

    return reservation;
  }

  static reconstitute(props: ReservationProps): Reservation {
    return new Reservation(props);
  }

  // ---------------------------------------------------------------------------
  // Lifecycle Transitions
  // ---------------------------------------------------------------------------

  commit(newOnHand: number): void {
    if (this._status !== 'reserved') {
      throw new ReservationConflictException(
        this._orderId,
        this._status,
        'commit',
      );
    }
    this._status = 'committed';
    this._updatedAt = new Date();

    this.apply(
      new StockCommittedEvent(
        this._orderId,
        this._sku.getValue(),
        this._quantity.getValue(),
        newOnHand,
        this._updatedAt,
      ),
    );
  }

  release(reason: string = 'Order cancelled before confirmation'): void {
    if (this._status !== 'reserved') {
      throw new ReservationConflictException(
        this._orderId,
        this._status,
        'release',
      );
    }
    this._status = 'released';
    this._updatedAt = new Date();

    this.apply(
      new StockReleasedEvent(
        this._orderId,
        this._sku.getValue(),
        this._quantity.getValue(),
        reason,
        this._updatedAt,
      ),
    );
  }

  reverse(reason: string = 'Order cancelled after confirmation'): void {
    if (this._status !== 'committed') {
      throw new ReservationConflictException(
        this._orderId,
        this._status,
        'reverse',
      );
    }
    this._status = 'reversed';
    this._updatedAt = new Date();

    this.apply(
      new StockReversedEvent(
        this._orderId,
        this._sku.getValue(),
        this._quantity.getValue(),
        reason,
        this._updatedAt,
      ),
    );
  }

  expire(): void {
    if (this._status !== 'reserved') {
      throw new ReservationConflictException(
        this._orderId,
        this._status,
        'expire',
      );
    }
    this._status = 'expired';
    this._updatedAt = new Date();

    this.apply(
      new ReservationExpiredEvent(
        this._orderId,
        this._sku.getValue(),
        this._quantity.getValue(),
        this._updatedAt,
      ),
    );
  }

  isExpired(): boolean {
    return this._status === 'reserved' && this._expiresAt < new Date();
  }

  // ---------------------------------------------------------------------------
  // Getters
  // ---------------------------------------------------------------------------

  get id(): string {
    return this._id;
  }

  get orderId(): string {
    return this._orderId;
  }

  get inventoryItemId(): string {
    return this._inventoryItemId;
  }

  get sku(): Sku {
    return this._sku;
  }

  get quantity(): Quantity {
    return this._quantity;
  }

  get status(): ReservationStatus {
    return this._status;
  }

  get expiresAt(): Date {
    return this._expiresAt;
  }

  get createdAt(): Date {
    return this._createdAt;
  }

  get updatedAt(): Date {
    return this._updatedAt;
  }
}
