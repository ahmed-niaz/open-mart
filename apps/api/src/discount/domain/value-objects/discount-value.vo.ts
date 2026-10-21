import { DiscountDomainException } from '../exceptions/discount-domain.exception.js';
import type { DiscountTypeValue } from '../../../shared/infrastructure/database/postgres/schema/discount.schema.js';

export class DiscountValue {
  private constructor(
    private readonly _type: DiscountTypeValue,
    private readonly _value: number | null,
  ) {}

  static percentage(basisPoints: number): DiscountValue {
    if (
      !Number.isInteger(basisPoints) ||
      basisPoints < 1 ||
      basisPoints > 10000
    ) {
      throw new DiscountDomainException(
        'Percentage discount value must be an integer between 1 and 10000 basis points (0.01% to 100%).',
      );
    }
    return new DiscountValue('percentage', basisPoints);
  }

  static fromPercentage(pct: number): DiscountValue {
    if (typeof pct !== 'number' || isNaN(pct) || pct <= 0 || pct > 100) {
      throw new DiscountDomainException(
        'Percentage value must be a number between 0.01 and 100.',
      );
    }
    const basisPoints = Math.round(pct * 100);
    return DiscountValue.percentage(basisPoints);
  }

  static fixedAmount(poishaAmount: number): DiscountValue {
    if (!Number.isInteger(poishaAmount) || poishaAmount <= 0) {
      throw new DiscountDomainException(
        'Fixed amount discount value must be a positive integer in minor units (poisha).',
      );
    }
    return new DiscountValue('fixed_amount', poishaAmount);
  }

  static freeShipping(): DiscountValue {
    return new DiscountValue('free_shipping', null);
  }

  get type(): DiscountTypeValue {
    return this._type;
  }

  get rawValue(): number | null {
    return this._value;
  }

  get basisPoints(): number | null {
    if (this._type === 'percentage') {
      return this._value;
    }
    return null;
  }

  get percentage(): number | null {
    if (this._type === 'percentage' && this._value !== null) {
      return this._value / 100;
    }
    return null;
  }

  /**
   * Calculates the calculated discount amount in poisha against the eligible subtotal.
   * Rounding: uses round-half-up (Math.round).
   * Enforces maxDiscountAmount cap if provided.
   */
  calculateDiscount(
    eligibleSubtotal: number,
    maxDiscountAmount?: number | null,
  ): number {
    if (eligibleSubtotal <= 0) {
      return 0;
    }

    let calculated = 0;

    switch (this._type) {
      case 'percentage': {
        // Basis points math: (eligibleSubtotal * basisPoints) / 10000
        // Round half up: Math.round
        calculated = Math.round((eligibleSubtotal * this._value!) / 10000);
        break;
      }
      case 'fixed_amount': {
        calculated = Math.min(this._value!, eligibleSubtotal);
        break;
      }
      case 'free_shipping': {
        calculated = 0;
        break;
      }
    }

    if (
      maxDiscountAmount !== undefined &&
      maxDiscountAmount !== null &&
      maxDiscountAmount > 0
    ) {
      calculated = Math.min(calculated, maxDiscountAmount);
    }

    return Math.max(0, Math.min(calculated, eligibleSubtotal));
  }
}
