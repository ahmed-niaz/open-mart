import { DomainException } from '../../../shared/domain/exceptions/domain.exception.js';

export class Sku {
  private readonly value: string;

  constructor(value: string) {
    if (!value || typeof value !== 'string') {
      throw new DomainException('SKU must be a non-empty string');
    }

    const normalized = value.trim().toUpperCase();
    if (normalized.length < 3 || normalized.length > 100) {
      throw new DomainException(
        `SKU length must be between 3 and 100 characters. Received: '${value}'`,
      );
    }

    if (!/^[A-Z0-9_\-.]+$/.test(normalized)) {
      throw new DomainException(
        `SKU must contain only letters, numbers, hyphens, dots, and underscores. Received: '${value}'`,
      );
    }

    this.value = normalized;
  }

  static create(value: string): Sku {
    return new Sku(value);
  }

  getValue(): string {
    return this.value;
  }

  equals(other: Sku): boolean {
    if (!other) return false;
    return this.value === other.value;
  }

  toString(): string {
    return this.value;
  }
}
