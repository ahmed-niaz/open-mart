import { DomainException } from '../../../shared/domain/exceptions/domain.exception.js';

export class Quantity {
  private readonly value: number;

  constructor(value: number) {
    if (typeof value !== 'number' || !Number.isInteger(value)) {
      throw new DomainException('Quantity must be an integer');
    }

    if (value < 0) {
      throw new DomainException(
        `Quantity cannot be negative. Received: ${value}`,
      );
    }

    this.value = value;
  }

  static create(value: number): Quantity {
    return new Quantity(value);
  }

  static zero(): Quantity {
    return new Quantity(0);
  }

  getValue(): number {
    return this.value;
  }

  add(other: Quantity | number): Quantity {
    const toAdd = typeof other === 'number' ? other : other.getValue();
    return new Quantity(this.value + toAdd);
  }

  subtract(other: Quantity | number): Quantity {
    const toSubtract = typeof other === 'number' ? other : other.getValue();
    if (this.value - toSubtract < 0) {
      throw new DomainException('Resulting quantity cannot be negative');
    }
    return new Quantity(this.value - toSubtract);
  }

  isGreaterThanOrEqualTo(other: Quantity | number): boolean {
    const compareVal = typeof other === 'number' ? other : other.getValue();
    return this.value >= compareVal;
  }

  isZero(): boolean {
    return this.value === 0;
  }

  equals(other: Quantity): boolean {
    if (!other) return false;
    return this.value === other.value;
  }
}
