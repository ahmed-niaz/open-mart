import { randomUUID } from 'node:crypto';
import { DiscountDomainException } from '../exceptions/discount-domain.exception.js';

export class DiscountId {
  private readonly _value: string;

  private constructor(value: string) {
    this._value = value;
  }

  static create(id?: string): DiscountId {
    if (id) {
      const uuidRegex =
        /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      if (!uuidRegex.test(id)) {
        throw new DiscountDomainException(`Invalid DiscountId format: ${id}`);
      }
      return new DiscountId(id.toLowerCase());
    }
    return new DiscountId(randomUUID());
  }

  static fromString(id: string): DiscountId {
    return DiscountId.create(id);
  }

  get value(): string {
    return this._value;
  }

  equals(other: DiscountId | null | undefined): boolean {
    if (!other) return false;
    return this._value === other._value;
  }

  toString(): string {
    return this._value;
  }
}
