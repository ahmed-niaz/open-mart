import { DomainException } from '../../../shared/domain/exceptions/domain.exception.js';

export class Slug {
  private readonly value: string;

  private constructor(value: string) {
    this.value = value;
  }

  public static create(raw: string): Slug {
    if (!raw || typeof raw !== 'string') {
      throw new DomainException('Slug cannot be empty.');
    }

    const normalized = raw
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');

    if (!normalized || normalized.length < 2) {
      throw new DomainException('Slug must be at least 2 characters long.');
    }

    if (normalized.length > 150) {
      throw new DomainException('Slug cannot exceed 150 characters.');
    }

    return new Slug(normalized);
  }

  public static fromPersisted(value: string): Slug {
    return new Slug(value);
  }

  public getValue(): string {
    return this.value;
  }

  public equals(other: Slug): boolean {
    return this.value === other.value;
  }

  public toString(): string {
    return this.value;
  }
}
