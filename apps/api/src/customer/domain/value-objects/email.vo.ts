import { DomainException } from '../../../shared/domain/exceptions/domain.exception.js';

export class Email {
  private static readonly EMAIL_REGEX =
    /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;

  private readonly _value: string;

  private constructor(value: string) {
    this._value = value;
  }

  static create(rawEmail: string): Email {
    if (!rawEmail || typeof rawEmail !== 'string') {
      throw new DomainException('Email must be a non-empty string');
    }

    const normalized = rawEmail.trim().toLowerCase();

    if (!Email.EMAIL_REGEX.test(normalized)) {
      throw new DomainException(`Invalid email address: "${rawEmail}"`);
    }

    if (normalized.length > 255) {
      throw new DomainException('Email address cannot exceed 255 characters');
    }

    return new Email(normalized);
  }

  static fromPersisted(value: string): Email {
    return new Email(value);
  }

  get value(): string {
    return this._value;
  }

  equals(other: Email): boolean {
    return this._value === other._value;
  }

  toString(): string {
    return this._value;
  }
}
