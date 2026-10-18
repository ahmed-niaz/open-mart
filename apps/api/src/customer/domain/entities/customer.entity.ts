import { AggregateRoot } from '../../../shared/domain/aggregate-root.js';
import { DomainException } from '../../../shared/domain/exceptions/domain.exception.js';
import { CustomerId } from '../value-objects/customer-id.vo.js';
import { Email } from '../value-objects/email.vo.js';
import { PasswordHash } from '../value-objects/password-hash.vo.js';
import { CustomerRegisteredEvent } from '../events/customer-registered.event.js';

export interface CustomerProps {
  id: CustomerId;
  email: Email;
  passwordHash: PasswordHash | null;
  googleId: string | null;
  firstName: string;
  lastName: string;
  phoneNumber: string | null;
  avatarUrl: string | null;
  isActive: boolean;
  isEmailVerified: boolean;
  version: number;
  lastLoginAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface RegisterWithCredentialsInput {
  email: Email;
  passwordHash: PasswordHash;
  firstName: string;
  lastName: string;
  phoneNumber?: string | null;
}

export interface RegisterWithGoogleInput {
  email: Email;
  googleId: string;
  firstName: string;
  lastName: string;
  avatarUrl?: string | null;
  phoneNumber?: string | null;
}

export class Customer extends AggregateRoot {
  private _id: CustomerId;
  private _email: Email;
  private _passwordHash: PasswordHash | null;
  private _googleId: string | null;
  private _firstName: string;
  private _lastName: string;
  private _phoneNumber: string | null;
  private _avatarUrl: string | null;
  private _isActive: boolean;
  private _isEmailVerified: boolean;
  private _version: number;
  private _lastLoginAt: Date | null;
  private _createdAt: Date;
  private _updatedAt: Date;

  private constructor(props: CustomerProps) {
    super();
    this._id = props.id;
    this._email = props.email;
    this._passwordHash = props.passwordHash;
    this._googleId = props.googleId;
    this._firstName = props.firstName;
    this._lastName = props.lastName;
    this._phoneNumber = props.phoneNumber;
    this._avatarUrl = props.avatarUrl;
    this._isActive = props.isActive;
    this._isEmailVerified = props.isEmailVerified;
    this._version = props.version;
    this._lastLoginAt = props.lastLoginAt;
    this._createdAt = props.createdAt;
    this._updatedAt = props.updatedAt;
  }

  static registerWithCredentials(
    input: RegisterWithCredentialsInput,
  ): Customer {
    const id = CustomerId.create();
    const now = new Date();

    const customer = new Customer({
      id,
      email: input.email,
      passwordHash: input.passwordHash,
      googleId: null,
      firstName: input.firstName.trim(),
      lastName: input.lastName.trim(),
      phoneNumber: input.phoneNumber?.trim() ?? null,
      avatarUrl: null,
      isActive: true,
      isEmailVerified: false,
      version: 1,
      lastLoginAt: null,
      createdAt: now,
      updatedAt: now,
    });

    customer.apply(
      new CustomerRegisteredEvent(
        id.getValue(),
        input.email.value,
        customer._firstName,
        customer._lastName,
        'credentials',
      ),
    );

    return customer;
  }

  static registerWithGoogle(input: RegisterWithGoogleInput): Customer {
    if (!input.googleId || input.googleId.trim().length === 0) {
      throw new DomainException(
        'Google ID is required for Google registration',
      );
    }

    const id = CustomerId.create();
    const now = new Date();

    const customer = new Customer({
      id,
      email: input.email,
      passwordHash: null,
      googleId: input.googleId.trim(),
      firstName: input.firstName.trim(),
      lastName: input.lastName.trim(),
      phoneNumber: input.phoneNumber?.trim() ?? null,
      avatarUrl: input.avatarUrl?.trim() ?? null,
      isActive: true,
      isEmailVerified: true, // Google accounts have pre-verified email addresses
      version: 1,
      lastLoginAt: now,
      createdAt: now,
      updatedAt: now,
    });

    customer.apply(
      new CustomerRegisteredEvent(
        id.getValue(),
        input.email.value,
        customer._firstName,
        customer._lastName,
        'google',
      ),
    );

    return customer;
  }

  static reconstitute(props: CustomerProps): Customer {
    return new Customer(props);
  }

  linkGoogleAccount(googleId: string, avatarUrl?: string | null): void {
    if (!googleId || googleId.trim().length === 0) {
      throw new DomainException('Google ID cannot be empty');
    }
    if (this._googleId && this._googleId !== googleId.trim()) {
      throw new DomainException(
        'Customer is already linked to a different Google account',
      );
    }

    this._googleId = googleId.trim();
    this._isEmailVerified = true;
    if (avatarUrl && !this._avatarUrl) {
      this._avatarUrl = avatarUrl.trim();
    }
    this._updatedAt = new Date();
  }

  updateProfile(input: {
    firstName?: string;
    lastName?: string;
    phoneNumber?: string | null;
    avatarUrl?: string | null;
  }): void {
    if (input.firstName !== undefined) {
      if (!input.firstName.trim())
        throw new DomainException('First name cannot be empty');
      this._firstName = input.firstName.trim();
    }
    if (input.lastName !== undefined) {
      if (!input.lastName.trim())
        throw new DomainException('Last name cannot be empty');
      this._lastName = input.lastName.trim();
    }
    if (input.phoneNumber !== undefined) {
      this._phoneNumber = input.phoneNumber?.trim() ?? null;
    }
    if (input.avatarUrl !== undefined) {
      this._avatarUrl = input.avatarUrl?.trim() ?? null;
    }

    this._updatedAt = new Date();
  }

  changePassword(newHash: PasswordHash): void {
    this._passwordHash = newHash;
    this._updatedAt = new Date();
  }

  verifyEmail(): void {
    if (this._isEmailVerified) return;
    this._isEmailVerified = true;
    this._updatedAt = new Date();
  }

  recordLogin(): void {
    this._lastLoginAt = new Date();
    this._updatedAt = new Date();
  }

  deactivate(): void {
    if (!this._isActive) {
      throw new DomainException('Customer is already deactivated');
    }
    this._isActive = false;
    this._updatedAt = new Date();
  }

  activate(): void {
    if (this._isActive) {
      throw new DomainException('Customer is already active');
    }
    this._isActive = true;
    this._updatedAt = new Date();
  }

  incrementVersion(): void {
    this._version++;
  }

  // Getters
  get id(): CustomerId {
    return this._id;
  }
  get email(): Email {
    return this._email;
  }
  get passwordHash(): PasswordHash | null {
    return this._passwordHash;
  }
  get googleId(): string | null {
    return this._googleId;
  }
  get firstName(): string {
    return this._firstName;
  }
  get lastName(): string {
    return this._lastName;
  }
  get fullName(): string {
    return [this._firstName, this._lastName].filter(Boolean).join(' ').trim();
  }
  get phoneNumber(): string | null {
    return this._phoneNumber;
  }
  get avatarUrl(): string | null {
    return this._avatarUrl;
  }
  get isActive(): boolean {
    return this._isActive;
  }
  get isEmailVerified(): boolean {
    return this._isEmailVerified;
  }
  get version(): number {
    return this._version;
  }
  get lastLoginAt(): Date | null {
    return this._lastLoginAt;
  }
  get createdAt(): Date {
    return this._createdAt;
  }
  get updatedAt(): Date {
    return this._updatedAt;
  }
}
