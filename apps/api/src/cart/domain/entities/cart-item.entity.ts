import { DomainException } from '../../../shared/domain/exceptions/domain.exception.js';

export const MAX_QUANTITY_PER_ITEM = 20;

export interface CartItemProps {
  id: string;
  cartId: string;
  productId: string;
  quantity: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateCartItemProps {
  id?: string;
  cartId: string;
  productId: string;
  quantity: number;
}

export class CartItem {
  private readonly _id: string;
  private readonly _cartId: string;
  private readonly _productId: string;
  private _quantity: number;
  private readonly _createdAt: Date;
  private _updatedAt: Date;

  private constructor(props: CartItemProps) {
    this._id = props.id;
    this._cartId = props.cartId;
    this._productId = props.productId;
    this._quantity = props.quantity;
    this._createdAt = props.createdAt;
    this._updatedAt = props.updatedAt;
  }

  static create(props: CreateCartItemProps): CartItem {
    if (!props.productId || props.productId.trim().length === 0) {
      throw new DomainException('Product ID is required for cart item');
    }
    if (props.quantity <= 0) {
      throw new DomainException('Quantity must be strictly positive');
    }
    if (props.quantity > MAX_QUANTITY_PER_ITEM) {
      throw new DomainException(
        `Cannot add more than ${MAX_QUANTITY_PER_ITEM} units of a single product to cart`,
      );
    }

    const now = new Date();
    return new CartItem({
      id: props.id ?? crypto.randomUUID(),
      cartId: props.cartId,
      productId: props.productId.trim(),
      quantity: props.quantity,
      createdAt: now,
      updatedAt: now,
    });
  }

  static reconstitute(props: CartItemProps): CartItem {
    return new CartItem(props);
  }

  updateQuantity(newQuantity: number): void {
    if (newQuantity <= 0) {
      throw new DomainException('Quantity must be strictly positive');
    }
    if (newQuantity > MAX_QUANTITY_PER_ITEM) {
      throw new DomainException(
        `Cannot exceed ${MAX_QUANTITY_PER_ITEM} units for this item`,
      );
    }
    this._quantity = newQuantity;
    this._updatedAt = new Date();
  }

  incrementQuantity(delta: number): void {
    const target = this._quantity + delta;
    if (target <= 0) {
      throw new DomainException('Resulting quantity must be strictly positive');
    }
    if (target > MAX_QUANTITY_PER_ITEM) {
      throw new DomainException(
        `Cannot exceed maximum of ${MAX_QUANTITY_PER_ITEM} units per item`,
      );
    }
    this._quantity = target;
    this._updatedAt = new Date();
  }

  get id(): string {
    return this._id;
  }

  get cartId(): string {
    return this._cartId;
  }

  get productId(): string {
    return this._productId;
  }

  get quantity(): number {
    return this._quantity;
  }

  get createdAt(): Date {
    return this._createdAt;
  }

  get updatedAt(): Date {
    return this._updatedAt;
  }
}
