import { Money } from '../../../shared/domain/value-objects/money.vo.js';
import { ShippingAddress } from '../value-objects/shipping-address.vo.js';

export interface ShippingCalculationInput {
  address: ShippingAddress;
  subtotalAmount: Money;
  freeShippingThreshold?: Money;
}

export class ShippingFeeCalculator {
  // Inside Dhaka delivery fee: ৳60 (6000 poisha / cents)
  static readonly INSIDE_DHAKA_FEE_CENTS = 6000;

  // Outside Dhaka delivery fee: ৳120 (12000 poisha / cents)
  static readonly OUTSIDE_DHAKA_FEE_CENTS = 12000;

  // Default free shipping threshold: ৳2000 (200000 poisha / cents)
  static readonly DEFAULT_FREE_SHIPPING_THRESHOLD_CENTS = 200000;

  /**
   * Deterministically calculates standard shipping fee based on delivery destination.
   */
  static calculate(input: ShippingCalculationInput): Money {
    const currency = input.subtotalAmount.getCurrency();
    const thresholdCents = input.freeShippingThreshold
      ? input.freeShippingThreshold.toCents()
      : ShippingFeeCalculator.DEFAULT_FREE_SHIPPING_THRESHOLD_CENTS;

    // Free shipping threshold check
    if (input.subtotalAmount.toCents() >= thresholdCents) {
      return Money.zero(currency);
    }

    const district = input.address.district?.toLowerCase().trim();
    const isInsideDhaka = district === 'dhaka';

    const feeCents = isInsideDhaka
      ? ShippingFeeCalculator.INSIDE_DHAKA_FEE_CENTS
      : ShippingFeeCalculator.OUTSIDE_DHAKA_FEE_CENTS;

    return Money.fromCents(feeCents, currency);
  }
}
