import { DomainException } from '../../../shared/domain/exceptions/domain.exception.js';

export const PAYMENT_PROVIDERS = ['stripe', 'cod', 'sslcommerz'] as const;

export type PaymentProviderValue = (typeof PAYMENT_PROVIDERS)[number];

export class PaymentProvider {
  private readonly value: PaymentProviderValue;

  private constructor(value: PaymentProviderValue) {
    this.value = value;
  }

  static fromString(value: string): PaymentProvider {
    const normalized = value.toLowerCase().trim() as PaymentProviderValue;
    if (!PAYMENT_PROVIDERS.includes(normalized)) {
      throw new DomainException(
        `Invalid payment provider '${value}'. Allowed providers: ${PAYMENT_PROVIDERS.join(', ')}`,
      );
    }
    return new PaymentProvider(normalized);
  }

  static stripe(): PaymentProvider {
    return new PaymentProvider('stripe');
  }

  static cod(): PaymentProvider {
    return new PaymentProvider('cod');
  }

  static sslcommerz(): PaymentProvider {
    return new PaymentProvider('sslcommerz');
  }

  getValue(): PaymentProviderValue {
    return this.value;
  }

  equals(other: PaymentProvider): boolean {
    return this.value === other.value;
  }

  isStripe(): boolean {
    return this.value === 'stripe';
  }

  isCod(): boolean {
    return this.value === 'cod';
  }

  isSslcommerz(): boolean {
    return this.value === 'sslcommerz';
  }

  toString(): string {
    return this.value;
  }
}
