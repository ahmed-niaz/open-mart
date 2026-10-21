import { DomainException } from '../../../shared/domain/exceptions/domain.exception.js';
import { Money } from '../../../shared/domain/value-objects/money.vo.js';

export interface PriceSnapshotProps {
  subtotal: Money;
  discountAmount: Money;
  shippingFee: Money;
  shippingFeeDiscount: Money;
  taxAmount: Money;
  total: Money;
}

export class PriceSnapshot {
  private readonly _subtotal: Money;
  private readonly _discountAmount: Money;
  private readonly _shippingFee: Money;
  private readonly _shippingFeeDiscount: Money;
  private readonly _taxAmount: Money;
  private readonly _total: Money;

  private constructor(props: PriceSnapshotProps) {
    this._subtotal = props.subtotal;
    this._discountAmount = props.discountAmount;
    this._shippingFee = props.shippingFee;
    this._shippingFeeDiscount = props.shippingFeeDiscount;
    this._taxAmount = props.taxAmount;
    this._total = props.total;
  }

  static create(props: PriceSnapshotProps): PriceSnapshot {
    if (props.subtotal.toCents() < 0) {
      throw new DomainException('Subtotal cannot be negative');
    }
    if (props.discountAmount.toCents() < 0) {
      throw new DomainException('Discount amount cannot be negative');
    }
    if (props.shippingFee.toCents() < 0) {
      throw new DomainException('Shipping fee cannot be negative');
    }
    if (props.shippingFeeDiscount.toCents() < 0) {
      throw new DomainException('Shipping fee discount cannot be negative');
    }
    if (props.total.toCents() < 0) {
      throw new DomainException('Total order amount cannot be negative');
    }

    return new PriceSnapshot(props);
  }

  get subtotal(): Money {
    return this._subtotal;
  }

  get discountAmount(): Money {
    return this._discountAmount;
  }

  get shippingFee(): Money {
    return this._shippingFee;
  }

  get shippingFeeDiscount(): Money {
    return this._shippingFeeDiscount;
  }

  get netShippingFee(): Money {
    const net = this._shippingFee.subtract(this._shippingFeeDiscount);
    return net.toCents() < 0
      ? Money.zero(this._shippingFee.getCurrency())
      : net;
  }

  get taxAmount(): Money {
    return this._taxAmount;
  }

  get total(): Money {
    return this._total;
  }

  toObject() {
    return {
      subtotalAmount: this._subtotal.toCents(),
      discountAmount: this._discountAmount.toCents(),
      shippingFeeAmount: this._shippingFee.toCents(),
      shippingFeeDiscountAmount: this._shippingFeeDiscount.toCents(),
      taxAmount: this._taxAmount.toCents(),
      totalAmount: this._total.toCents(),
      currency: this._total.getCurrency(),
    };
  }
}
