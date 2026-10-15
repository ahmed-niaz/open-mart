import { DomainException } from '../exceptions/domain.exception.js';

export class Money {
  // do not expose entarnal properties - make private
  private constructor(
    private readonly amount: number,
    private readonly currency: string,
  ) {}

  static create(amount: number, currency: string = 'USD'): Money {
    if (amount < 0) {
      throw new DomainException('the amount of money cannot be negative');
    }

    const normalized = Math.round((amount * 100) / 100);
    return new Money(normalized, currency.toUpperCase());
  }

  static zero(currency: string = 'USD'): Money {
    return new Money(0, currency.toUpperCase());
  }

  static fromCents(cents: number, currency: string = 'USD'): Money {
    return new Money(cents / 100, currency.toUpperCase());
  }

  multiply(factor: number): Money {
    if (factor < 0) {
      throw new DomainException('the factor cannot be negative');
    }
    return Money.create(this.amount * factor, this.currency);
  }

  add(other: Money): Money {
    this.assertSameCurrency(other);
    return Money.create(this.amount + other.amount, this.currency);
  }

  isGreaterThan(other: Money): boolean {
    this.assertSameCurrency(other);
    return this.amount > other.amount;
  }

  subtract(other: Money): Money {
    this.assertSameCurrency(other);
    const result = this.amount - other.amount;
    if (result < 0) {
      throw new DomainException('the result of subtraction cannot be negative');
    }
    return Money.create(result, this.currency);
  }

  getAmount(): number {
    return this.amount;
  }

  getCurrency(): string {
    return this.currency;
  }

  toCents(): number {
    return Math.round(this.amount * 100);
  }

  private assertSameCurrency(other: Money): void {
    if (this.currency !== other.currency) {
      throw new DomainException(
        'cannot perform operation on money with different currencies',
      );
    }
  }
}
