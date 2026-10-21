import { DomainException } from '../../../shared/domain/exceptions/domain.exception.js';

export class CartId {
  private readonly value: string;

  private constructor(value: string) {
    this.value = value;
  }

  static generate(): CartId {
    return new CartId(crypto.randomUUID());
  }

  static fromString(value: string): CartId {
    if (!value || value.trim().length === 0) {
      throw new DomainException('Cart ID cannot be empty');
    }
    const trimmed = value.trim();
    const uuidRegex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(trimmed)) {
      throw new DomainException(`Invalid Cart ID format: '${value}'`);
    }
    return new CartId(trimmed);
  }

  getValue(): string {
    return this.value;
  }

  equals(other: CartId): boolean {
    return this.value === other.value;
  }

  toString(): string {
    return this.value;
  }
}
