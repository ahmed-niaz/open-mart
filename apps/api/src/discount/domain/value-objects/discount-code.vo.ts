import { DiscountDomainException } from '../exceptions/discount-domain.exception.js';

export class DiscountCode {
  private readonly _value: string;

  private constructor(value: string) {
    this._value = value;
  }

  static create(rawCode: string): DiscountCode {
    if (!rawCode || typeof rawCode !== 'string') {
      throw new DiscountDomainException('Discount code cannot be empty.');
    }

    const normalized = rawCode.trim().toUpperCase();

    if (normalized.length < 3 || normalized.length > 50) {
      throw new DiscountDomainException(
        'Discount code must be between 3 and 50 characters.',
      );
    }

    const codeRegex = /^[A-Z0-9_-]+$/;
    if (!codeRegex.test(normalized)) {
      throw new DiscountDomainException(
        'Discount code can only contain letters, numbers, hyphens, and underscores.',
      );
    }

    return new DiscountCode(normalized);
  }

  get value(): string {
    return this._value;
  }

  equals(other: DiscountCode | null | undefined): boolean {
    if (!other) return false;
    return this._value === other._value;
  }

  toString(): string {
    return this._value;
  }
}
