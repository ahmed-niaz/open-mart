import { randomUUID } from 'node:crypto';
import { DomainException } from '../../../shared/domain/exceptions/domain.exception.js';

export class AdminId {
  private readonly _value: string;

  private constructor(value: string) {
    this._value = value;
  }

  static create(id?: string): AdminId {
    if (id) {
      const uuidRegex =
        /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      if (!uuidRegex.test(id)) {
        throw new DomainException(`Invalid AdminId format: ${id}`);
      }
      return new AdminId(id.toLowerCase());
    }
    return new AdminId(randomUUID());
  }

  get value(): string {
    return this._value;
  }

  equals(other: AdminId | null | undefined): boolean {
    if (!other) return false;
    return this._value === other._value;
  }

  toString(): string {
    return this._value;
  }
}
