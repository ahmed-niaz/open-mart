import { DomainException } from '../../../shared/domain/exceptions/domain.exception.js';
import { Money } from '../../../shared/domain/value-objects/money.vo.js';
import { OrderItemId } from '../value-objects/order-item-id.vo.js';

export interface OrderItemProps {
  id: OrderItemId;
  productId: string;
  productName: string;
  productSku: string;
  unitPrice: Money;
  quantity: number;
}

export class OrderItem {
  private readonly _id: OrderItemId;
  private readonly _productId: string;
  private readonly _productName: string;
  private readonly _productSku: string;
  private readonly _unitPrice: Money;
  private readonly _quantity: number;

  private constructor(props: OrderItemProps) {
    this._id = props.id;
    this._productId = props.productId;
    this._productName = props.productName;
    this._productSku = props.productSku;
    this._unitPrice = props.unitPrice;
    this._quantity = props.quantity;
  }

  static create(props: {
    productId: string;
    productName: string;
    productSku: string;
    unitPrice: Money;
    quantity: number;
  }): OrderItem {
    if (!props.productId || props.productId.trim().length === 0) {
      throw new DomainException('Product ID is required for order item');
    }
    if (!props.productName || props.productName.trim().length === 0) {
      throw new DomainException('Product name is required for order item');
    }
    if (!props.productSku || props.productSku.trim().length === 0) {
      throw new DomainException('Product SKU is required for order item');
    }
    if (
      !props.quantity ||
      props.quantity <= 0 ||
      !Number.isInteger(props.quantity)
    ) {
      throw new DomainException('Item quantity must be a positive integer');
    }

    return new OrderItem({
      id: OrderItemId.generate(),
      productId: props.productId.trim(),
      productName: props.productName.trim(),
      productSku: props.productSku.trim(),
      unitPrice: props.unitPrice,
      quantity: props.quantity,
    });
  }

  static reconstitute(props: OrderItemProps): OrderItem {
    return new OrderItem(props);
  }

  get id(): OrderItemId {
    return this._id;
  }

  get productId(): string {
    return this._productId;
  }

  get productName(): string {
    return this._productName;
  }

  get productSku(): string {
    return this._productSku;
  }

  get unitPrice(): Money {
    return this._unitPrice;
  }

  get quantity(): number {
    return this._quantity;
  }

  getSubtotal(): Money {
    return this._unitPrice.multiply(this._quantity);
  }
}
