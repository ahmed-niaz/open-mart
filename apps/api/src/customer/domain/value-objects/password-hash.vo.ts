import { DomainException } from '../../../shared/domain/exceptions/domain.exception.js';

export class PasswordHash {
  private readonly _value: string;

  private constructor(value: string) {
    this._value = value;
  }

  static create(hash: string): PasswordHash {
    if (!hash || typeof hash !== 'string' || hash.trim().length === 0) {
      throw new DomainException('Password hash cannot be empty');
    }
    return new PasswordHash(hash);
  }

  get value(): string {
    return this._value;
  }
}
