import { describe, expect, it, vi } from 'vitest';
import { PaymentStrategyRegistry } from './payment-strategy.registry.js';
import { StripePaymentStrategy } from './stripe.strategy.js';
import { CodPaymentStrategy } from './cod.strategy.js';
import { SslCommerzPaymentStrategy } from './sslcommerz.strategy.js';
import { ApplicationException } from '../../../shared/domain/exceptions/application.exception.js';

describe('PaymentStrategyRegistry', () => {
  const stripeMock = {
    getProviderName: vi.fn().mockReturnValue('stripe'),
  } as unknown as StripePaymentStrategy;

  const codMock = {
    getProviderName: vi.fn().mockReturnValue('cod'),
  } as unknown as CodPaymentStrategy;

  const sslMock = {
    getProviderName: vi.fn().mockReturnValue('sslcommerz'),
  } as unknown as SslCommerzPaymentStrategy;

  const registry = new PaymentStrategyRegistry(stripeMock, codMock, sslMock);

  it('should retrieve stripe strategy', () => {
    const strategy = registry.getStrategy('stripe');
    expect(strategy.getProviderName()).toBe('stripe');
  });

  it('should retrieve cod strategy', () => {
    const strategy = registry.getStrategy('cod');
    expect(strategy.getProviderName()).toBe('cod');
  });

  it('should retrieve sslcommerz strategy', () => {
    const strategy = registry.getStrategy('sslcommerz');
    expect(strategy.getProviderName()).toBe('sslcommerz');
  });

  it('should throw ApplicationException for unsupported provider', () => {
    expect(() => registry.getStrategy('paypal')).toThrow(ApplicationException);
  });
});
