import { DomainException } from '../../../shared/domain/exceptions/domain.exception.js';

export const CART_STATUSES = [
  'active',
  'locked',
  'converted',
  'merged',
  'abandoned',
] as const;

export type CartStatusValue = (typeof CART_STATUSES)[number];

const ALLOWED_TRANSITIONS: Record<CartStatusValue, readonly CartStatusValue[]> =
  {
    active: ['locked', 'converted', 'merged', 'abandoned'],
    locked: ['active', 'converted'],
    abandoned: ['active'],
    converted: [],
    merged: [],
  };

export class CartStatus {
  private readonly value: CartStatusValue;

  private constructor(value: CartStatusValue) {
    this.value = value;
  }

  static fromString(value: string): CartStatus {
    const normalized = value.toLowerCase().trim() as CartStatusValue;
    if (!CART_STATUSES.includes(normalized)) {
      throw new DomainException(
        `Invalid cart status '${value}'. Allowed: ${CART_STATUSES.join(', ')}`,
      );
    }
    return new CartStatus(normalized);
  }

  static active(): CartStatus {
    return new CartStatus('active');
  }

  static locked(): CartStatus {
    return new CartStatus('locked');
  }

  static converted(): CartStatus {
    return new CartStatus('converted');
  }

  static merged(): CartStatus {
    return new CartStatus('merged');
  }

  static abandoned(): CartStatus {
    return new CartStatus('abandoned');
  }

  getValue(): CartStatusValue {
    return this.value;
  }

  canTransitionTo(target: CartStatusValue): boolean {
    return ALLOWED_TRANSITIONS[this.value].includes(target);
  }

  transitionTo(target: CartStatusValue): CartStatus {
    if (!this.canTransitionTo(target)) {
      throw new DomainException(
        `Cannot transition cart status from '${this.value}' to '${target}'`,
      );
    }
    return new CartStatus(target);
  }

  isActive(): boolean {
    return this.value === 'active';
  }

  isLocked(): boolean {
    return this.value === 'locked';
  }

  isConverted(): boolean {
    return this.value === 'converted';
  }

  isMerged(): boolean {
    return this.value === 'merged';
  }

  isAbandoned(): boolean {
    return this.value === 'abandoned';
  }

  equals(other: CartStatus): boolean {
    return this.value === other.value;
  }

  toString(): string {
    return this.value;
  }
}
