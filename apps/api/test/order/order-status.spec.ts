import { describe, expect, it } from 'vitest';
import { OrderStatus } from '../../src/order/domain/value-objects/order-status.vo.js';
import { DomainException } from '../../src/shared/domain/exceptions/domain.exception.js';

describe('OrderStatus Value Object (Transition Invariants)', () => {
  it('should allow valid transitions according to state machine', () => {
    // pending -> confirmed -> processing -> shipped -> delivered
    let status = OrderStatus.pending();
    expect(status.isPending()).toBe(true);

    status = status.confirm();
    expect(status.isConfirmed()).toBe(true);

    status = status.process();
    expect(status.isProcessing()).toBe(true);

    status = status.ship();
    expect(status.isShipped()).toBe(true);

    status = status.deliver();
    expect(status.isDelivered()).toBe(true);
  });

  it('should allow pending -> cancelled', () => {
    const status = OrderStatus.pending();
    const cancelled = status.cancel();
    expect(cancelled.isCancelled()).toBe(true);
  });

  it('should allow confirmed -> cancelled', () => {
    const status = OrderStatus.confirmed();
    const cancelled = status.cancel();
    expect(cancelled.isCancelled()).toBe(true);
  });

  it('should allow processing -> cancelled', () => {
    const status = OrderStatus.processing();
    const cancelled = status.cancel();
    expect(cancelled.isCancelled()).toBe(true);
  });

  it('should allow shipped -> returned', () => {
    const status = OrderStatus.shipped();
    const returned = status.returnOrder();
    expect(returned.isReturned()).toBe(true);
  });

  it('should reject invalid transitions: delivered -> none', () => {
    const status = OrderStatus.delivered();
    expect(() => status.cancel()).toThrow(DomainException);
    expect(() => status.returnOrder()).toThrow(DomainException);
    expect(() => status.ship()).toThrow(DomainException);
  });

  it('should reject invalid transitions: cancelled -> none', () => {
    const status = OrderStatus.cancelled();
    expect(() => status.confirm()).toThrow(DomainException);
    expect(() => status.deliver()).toThrow(DomainException);
    expect(() => status.cancel()).toThrow(DomainException);
  });

  it('should reject invalid transitions: returned -> none', () => {
    const status = OrderStatus.returned();
    expect(() => status.deliver()).toThrow(DomainException);
    expect(() => status.cancel()).toThrow(DomainException);
  });

  it('should reject direct jump: pending -> delivered', () => {
    const status = OrderStatus.pending();
    expect(() => status.deliver()).toThrow(DomainException);
  });

  it('should parse valid status strings', () => {
    expect(OrderStatus.fromString('RETURNED').isReturned()).toBe(true);
    expect(OrderStatus.fromString('SHIPPED').isShipped()).toBe(true);
  });
});
