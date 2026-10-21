import { AdminDomainException } from '../exceptions/admin-domain.exception.js';

export class AdminEmail {
  private readonly _value: string;

  private constructor(value: string) {
    this._value = value;
  }

  static create(email: string): AdminEmail {
    if (!email || typeof email !== 'string') {
      throw new AdminDomainException('Admin email cannot be empty');
    }

    const normalized = email.trim().toLowerCase();

    // RFC 5322 compliant regex for standard email validation
    const emailRegex =
      /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;

    if (!emailRegex.test(normalized)) {
      throw new AdminDomainException(`Invalid admin email format: ${email}`);
    }

    if (normalized.length > 255) {
      throw new AdminDomainException(
        'Admin email cannot exceed 255 characters',
      );
    }

    return new AdminEmail(normalized);
  }

  get value(): string {
    return this._value;
  }

  equals(other: AdminEmail | null | undefined): boolean {
    if (!other) return false;
    return this._value === other._value;
  }

  toString(): string {
    return this._value;
  }
}
