import { AggregateRoot } from '../../../shared/domain/aggregate-root.js';
import { DomainException } from '../../../shared/domain/exceptions/domain.exception.js';
import { CartId } from '../value-objects/cart-id.vo.js';
import { CartStatus } from '../value-objects/cart-status.vo.js';
import { CartItem, MAX_QUANTITY_PER_ITEM } from './cart-item.entity.js';
import { CartCreatedEvent } from '../events/cart-created.event.js';
import { CartItemAddedEvent } from '../events/cart-item-added.event.js';
import { CartItemUpdatedEvent } from '../events/cart-item-updated.event.js';
import { CartItemRemovedEvent } from '../events/cart-item-removed.event.js';
import { CartClearedEvent } from '../events/cart-cleared.event.js';
import { CartMergedEvent } from '../events/cart-merged.event.js';
import { CartConvertedEvent } from '../events/cart-converted.event.js';
import { CartAbandonedEvent } from '../events/cart-abandoned.event.js';

export const MAX_CART_DISTINCT_ITEMS = 50;

export interface CartProps {
  id: CartId;
  customerId: string | null;
  guestId: string | null;
  status: CartStatus;
  currency: string;
  convertedOrderId: string | null;
  lastActivityAt: Date;
  version: number;
  items: CartItem[];
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateCartProps {
  id?: CartId;
  customerId?: string | null;
  guestId?: string | null;
  currency?: string;
}

export class Cart extends AggregateRoot {
  private readonly _id: CartId;
  private _customerId: string | null;
  private readonly _guestId: string | null;
  private _status: CartStatus;
  private readonly _currency: string;
  private _convertedOrderId: string | null;
  private _lastActivityAt: Date;
  private _version: number;
  private _items: CartItem[];
  private readonly _createdAt: Date;
  private _updatedAt: Date;

  private constructor(props: CartProps) {
    super();
    this._id = props.id;
    this._customerId = props.customerId;
    this._guestId = props.guestId;
    this._status = props.status;
    this._currency = props.currency;
    this._convertedOrderId = props.convertedOrderId;
    this._lastActivityAt = props.lastActivityAt;
    this._version = props.version;
    this._items = props.items;
    this._createdAt = props.createdAt;
    this._updatedAt = props.updatedAt;
  }

  static create(props: CreateCartProps): Cart {
    const customerId = props.customerId?.trim() || null;
    const guestId = props.guestId?.trim() || null;

    if (!customerId && !guestId) {
      throw new DomainException(
        'Cart must belong to either a registered customer or an anonymous guest session',
      );
    }

    const now = new Date();
    const id = props.id ?? CartId.generate();
    const currency = (props.currency ?? 'BDT').toUpperCase().trim();

    const cart = new Cart({
      id,
      customerId,
      guestId,
      status: CartStatus.active(),
      currency,
      convertedOrderId: null,
      lastActivityAt: now,
      version: 1,
      items: [],
      createdAt: now,
      updatedAt: now,
    });

    cart.apply(new CartCreatedEvent(id.getValue(), customerId, guestId, now));

    return cart;
  }

  static reconstitute(props: CartProps): Cart {
    return new Cart(props);
  }

  // ---------------------------------------------------------------------------
  // Mutating Actions & Invariant Enforcement
  // ---------------------------------------------------------------------------

  private ensureMutable(): void {
    if (this._status.isAbandoned()) {
      // Reactivate abandoned cart when customer returns
      this._status = this._status.transitionTo('active');
      return;
    }

    if (!this._status.isActive()) {
      throw new DomainException(
        `Cannot mutate cart in '${this._status.getValue()}' status`,
      );
    }
  }

  addItem(productId: string, quantity: number): CartItem {
    this.ensureMutable();

    if (quantity <= 0) {
      throw new DomainException('Quantity must be strictly positive');
    }

    const existingIndex = this._items.findIndex(
      (item) => item.productId === productId,
    );

    let resultingItem: CartItem;

    if (existingIndex >= 0) {
      const existing = this._items[existingIndex];
      const newTotal = existing.quantity + quantity;
      if (newTotal > MAX_QUANTITY_PER_ITEM) {
        throw new DomainException(
          `Cannot exceed ${MAX_QUANTITY_PER_ITEM} units for product '${productId}' in cart`,
        );
      }
      existing.incrementQuantity(quantity);
      resultingItem = existing;
    } else {
      if (this._items.length >= MAX_CART_DISTINCT_ITEMS) {
        throw new DomainException(
          `Cart cannot contain more than ${MAX_CART_DISTINCT_ITEMS} distinct items`,
        );
      }
      const newItem = CartItem.create({
        cartId: this._id.getValue(),
        productId,
        quantity,
      });
      this._items.push(newItem);
      resultingItem = newItem;
    }

    this.touchActivity();

    this.apply(
      new CartItemAddedEvent(
        this._id.getValue(),
        productId,
        resultingItem.quantity,
        this.totalQuantity,
        new Date(),
      ),
    );

    return resultingItem;
  }

  updateItemQuantity(productId: string, quantity: number): void {
    this.ensureMutable();

    if (quantity <= 0) {
      this.removeItem(productId);
      return;
    }

    const item = this._items.find((i) => i.productId === productId);
    if (!item) {
      throw new DomainException(`Product '${productId}' is not in cart`);
    }

    item.updateQuantity(quantity);
    this.touchActivity();

    this.apply(
      new CartItemUpdatedEvent(
        this._id.getValue(),
        productId,
        quantity,
        new Date(),
      ),
    );
  }

  removeItem(productId: string): void {
    this.ensureMutable();

    const initialCount = this._items.length;
    this._items = this._items.filter((item) => item.productId !== productId);

    if (this._items.length !== initialCount) {
      this.touchActivity();
      this.apply(
        new CartItemRemovedEvent(
          this._id.getValue(),
          productId,
          this.totalQuantity,
          new Date(),
        ),
      );
    }
  }

  clear(): void {
    this.ensureMutable();
    if (this._items.length === 0) {
      return;
    }

    this._items = [];
    this.touchActivity();

    this.apply(new CartClearedEvent(this._id.getValue(), new Date()));
  }

  // ---------------------------------------------------------------------------
  // Lifecycle & Merging
  // ---------------------------------------------------------------------------

  lock(): void {
    this._status = this._status.transitionTo('locked');
    this.touchActivity();
  }

  unlock(): void {
    this._status = this._status.transitionTo('active');
    this.touchActivity();
  }

  markConverted(orderId: string): void {
    if (!orderId || orderId.trim().length === 0) {
      throw new DomainException('Converted Order ID is required');
    }

    // Allow conversion from either active or locked state
    if (this._status.isLocked()) {
      this._status = this._status.transitionTo('converted');
    } else if (this._status.isActive()) {
      this._status = this._status.transitionTo('converted');
    } else {
      throw new DomainException(
        `Cannot convert cart in '${this._status.getValue()}' status`,
      );
    }

    this._convertedOrderId = orderId.trim();
    this.touchActivity();

    this.apply(
      new CartConvertedEvent(
        this._id.getValue(),
        this._convertedOrderId,
        new Date(),
      ),
    );
  }

  markMerged(): void {
    this._status = this._status.transitionTo('merged');
    this.touchActivity();
  }

  markAbandoned(): void {
    this._status = this._status.transitionTo('abandoned');
    this._updatedAt = new Date();

    this.apply(
      new CartAbandonedEvent(
        this._id.getValue(),
        this._customerId,
        this._guestId,
        this.totalQuantity,
        this._lastActivityAt,
        new Date(),
      ),
    );
  }

  assignCustomer(customerId: string): void {
    if (!customerId || customerId.trim().length === 0) {
      throw new DomainException('Customer ID is required');
    }
    this._customerId = customerId.trim();
    this.touchActivity();
  }

  merge(guestCart: Cart): void {
    this.ensureMutable();

    if (!this._customerId) {
      throw new DomainException(
        'Cannot merge into a cart that does not belong to an authenticated customer',
      );
    }

    if (guestCart.id.equals(this._id)) {
      return; // Same cart
    }

    for (const guestItem of guestCart.items) {
      const existing = this._items.find(
        (i) => i.productId === guestItem.productId,
      );
      if (existing) {
        const sum = existing.quantity + guestItem.quantity;
        const capped = Math.min(sum, MAX_QUANTITY_PER_ITEM);
        existing.updateQuantity(capped);
      } else {
        if (this._items.length < MAX_CART_DISTINCT_ITEMS) {
          this._items.push(
            CartItem.create({
              cartId: this._id.getValue(),
              productId: guestItem.productId,
              quantity: guestItem.quantity,
            }),
          );
        }
      }
    }

    guestCart.markMerged();
    this.touchActivity();

    this.apply(
      new CartMergedEvent(
        this._id.getValue(),
        guestCart.id.getValue(),
        this._customerId,
        this.totalQuantity,
        new Date(),
      ),
    );
  }

  // ---------------------------------------------------------------------------
  // Concurrency & Metadata
  // ---------------------------------------------------------------------------

  incrementVersion(): void {
    this._version += 1;
    this._updatedAt = new Date();
  }

  private touchActivity(): void {
    const now = new Date();
    this._lastActivityAt = now;
    this._updatedAt = now;
  }

  // ---------------------------------------------------------------------------
  // Getters
  // ---------------------------------------------------------------------------

  get id(): CartId {
    return this._id;
  }

  get customerId(): string | null {
    return this._customerId;
  }

  get guestId(): string | null {
    return this._guestId;
  }

  get status(): CartStatus {
    return this._status;
  }

  get currency(): string {
    return this._currency;
  }

  get convertedOrderId(): string | null {
    return this._convertedOrderId;
  }

  get lastActivityAt(): Date {
    return this._lastActivityAt;
  }

  get version(): number {
    return this._version;
  }

  get items(): readonly CartItem[] {
    return [...this._items];
  }

  get totalQuantity(): number {
    return this._items.reduce((sum, item) => sum + item.quantity, 0);
  }

  get distinctItemCount(): number {
    return this._items.length;
  }

  get createdAt(): Date {
    return this._createdAt;
  }

  get updatedAt(): Date {
    return this._updatedAt;
  }
}
