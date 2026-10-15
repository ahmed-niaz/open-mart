import { DomainException } from '../../../shared/domain/exceptions/domain.exception.js';

export class SKU {
  private static readonly SKU_PATTERN = /^[A-Za-z0-9-]+$/;
  private static readonly MIN_LENGTH = 3;
  private static readonly MAX_LENGTH = 50;

  private readonly value: string; //immutable

  private constructor(value: string) {
    this.value = value;
  }

  //   bussiness logic [v.o becasue its has not identity]
  static create(value: string): SKU {
    const trimmed = value.trim();

    if (trimmed.length < SKU.MIN_LENGTH || trimmed.length > SKU.MAX_LENGTH) {
      throw new DomainException(
        `SKU must be between ${SKU.MIN_LENGTH} and ${SKU.MAX_LENGTH} chars`,
      );
    }
    if (!SKU.SKU_PATTERN.test(trimmed)) {
      throw new DomainException('Invalid SKU format');
    }

    return new SKU(trimmed.toUpperCase());
  }

  equals(other: SKU) {
    return this.value === other.value;
  }

  getValue(): string {
    return this.value;
  }

  toString(): string {
    return this.value;
  }
}
