import { describe, expect, it } from 'vitest';
import { Payment } from './payment.entity.js';
import { PaymentProvider } from '../value-objects/payment-provider.vo.js';
import { Money } from '../../../shared/domain/value-objects/money.vo.js';
import { DomainException } from '../../../shared/domain/exceptions/domain.exception.js';

describe('Payment Aggregate Root', () => {
  const defaultOrderId = crypto.randomUUID();
  const defaultAmount = Money.fromCents(2500, 'USD'); // $25.00

  it('should initialize a payment in pending status with version 1', () => {
    const payment = Payment.create({
      orderId: defaultOrderId,
      customerId: 'cust-123',
      provider: PaymentProvider.stripe(),
      amount: defaultAmount,
    });

    expect(payment.id).toBeDefined();
    expect(payment.orderId).toBe(defaultOrderId);
    expect(payment.customerId).toBe('cust-123');
    expect(payment.provider.isStripe()).toBe(true);
    expect(payment.status.isPending()).toBe(true);
    expect(payment.amount.toCents()).toBe(2500);
    expect(payment.amount.getCurrency()).toBe('USD');
    expect(payment.version).toBe(1);
    expect(payment.paidAt).toBeNull();
  });

  it('should throw DomainException if payment amount is zero or negative', () => {
    expect(() =>
      Payment.create({
        orderId: defaultOrderId,
        provider: PaymentProvider.stripe(),
        amount: Money.zero('USD'),
      }),
    ).toThrow(DomainException);
  });

  it('should transition from pending to processing and then completed', () => {
    const payment = Payment.create({
      orderId: defaultOrderId,
      provider: PaymentProvider.stripe(),
      amount: defaultAmount,
    });

    payment.setProcessing();
    expect(payment.status.isProcessing()).toBe(true);

    const paidAt = new Date();
    payment.complete('pi_test_12345', paidAt);
    expect(payment.status.isCompleted()).toBe(true);
    expect(payment.transactionId).toBe('pi_test_12345');
    expect(payment.paidAt).toEqual(paidAt);
  });

  it('should transition to failed with code and reason', () => {
    const payment = Payment.create({
      orderId: defaultOrderId,
      provider: PaymentProvider.stripe(),
      amount: defaultAmount,
    });

    payment.fail('Card declined', 'card_declined');
    expect(payment.status.isFailed()).toBe(true);
    expect(payment.failureReason).toBe('Card declined');
    expect(payment.failureCode).toBe('card_declined');
  });

  it('should transition to cancelled', () => {
    const payment = Payment.create({
      orderId: defaultOrderId,
      provider: PaymentProvider.cod(),
      amount: defaultAmount,
    });

    payment.cancel('Customer changed mind');
    expect(payment.status.isCancelled()).toBe(true);
    expect(payment.failureReason).toBe('Customer changed mind');
  });

  it('should transition to needs_review when an anomaly occurs', () => {
    const payment = Payment.create({
      orderId: defaultOrderId,
      provider: PaymentProvider.stripe(),
      amount: defaultAmount,
    });

    payment.markNeedsReview('Currency mismatch', Money.fromCents(2500, 'EUR'));
    expect(payment.status.isNeedsReview()).toBe(true);
    expect(payment.failureReason).toBe('Currency mismatch');
  });

  it('should handle partial and full refunds correctly', () => {
    const payment = Payment.create({
      orderId: defaultOrderId,
      provider: PaymentProvider.stripe(),
      amount: defaultAmount, // 2500 cents
    });

    payment.complete('ch_123');

    // Partial refund of $10 (1000 cents)
    payment.refund(Money.fromCents(1000, 'USD'), 're_1');
    expect(payment.status.getValue()).toBe('partially_refunded');
    expect(payment.refundedAmount.toCents()).toBe(1000);

    // Full refund of remainder $15 (1500 cents)
    payment.refund(Money.fromCents(1500, 'USD'), 're_2');
    expect(payment.status.getValue()).toBe('refunded');
    expect(payment.refundedAmount.toCents()).toBe(2500);
  });

  it('should prevent refund amount exceeding total charge', () => {
    const payment = Payment.create({
      orderId: defaultOrderId,
      provider: PaymentProvider.stripe(),
      amount: defaultAmount, // 2500 cents
    });
    payment.complete('ch_123');

    expect(() =>
      payment.refund(Money.fromCents(3000, 'USD'), 're_fail'),
    ).toThrow(DomainException);
  });

  it('should increment version for OCC', () => {
    const payment = Payment.create({
      orderId: defaultOrderId,
      provider: PaymentProvider.stripe(),
      amount: defaultAmount,
    });

    expect(payment.version).toBe(1);
    payment.incrementVersion();
    expect(payment.version).toBe(2);
  });
});
