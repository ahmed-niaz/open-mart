import { beforeEach, describe, expect, it, vi } from 'vitest';
import { EventBus } from '@nestjs/cqrs';
import { ProcessWebhookCommandHandler } from './process-webhook.handler.js';
import { ProcessWebhookCommand } from './process-webhook.command.js';
import { PaymentRepositoryPort } from '../../ports/payment.repository.js';
import { PaymentStrategyRegistry } from '../../../infrastructure/strategies/payment-strategy.registry.js';
import { PaymentGatewayStrategy } from '../../ports/payment-gateway-strategy.port.js';
import { Money } from '../../../../shared/domain/value-objects/money.vo.js';
import { Payment } from '../../../domain/entities/payment.entity.js';
import { PaymentProvider } from '../../../domain/value-objects/payment-provider.vo.js';
import { PaymentCompletedIntegrationEvent } from '../../../../shared/contracts/events/payment-completed.event.js';

describe('ProcessWebhookCommandHandler', () => {
  let handler: ProcessWebhookCommandHandler;
  let mockPaymentRepo: PaymentRepositoryPort;
  let mockStrategyRegistry: PaymentStrategyRegistry;
  let mockStrategy: PaymentGatewayStrategy;
  let mockEventBus: EventBus;

  const orderId = crypto.randomUUID();

  beforeEach(() => {
    mockPaymentRepo = {
      save: vi.fn().mockResolvedValue(undefined),
      findById: vi.fn(),
      findByOrderId: vi.fn(),
      findByTransactionId: vi.fn(),
      findRefundsByPaymentId: vi.fn().mockResolvedValue([]),
      findRefundsByOrderId: vi.fn().mockResolvedValue([]),
      processWebhookEventAtomic: vi
        .fn()
        .mockImplementation(async (_evt, callback) => {
          await callback(mockPaymentRepo);
          return true;
        }),
    };

    mockStrategy = {
      getProviderName: vi.fn().mockReturnValue('stripe'),
      initiatePayment: vi.fn(),
      verifyAndParseWebhook: vi.fn().mockResolvedValue({
        eventType: 'payment.succeeded',
        transactionId: 'pi_test_123',
        orderId,
        amount: Money.fromCents(5000, 'USD'),
        gatewayPayload: { id: 'evt_test_123' },
      }),
    };

    mockStrategyRegistry = {
      getStrategy: vi.fn().mockReturnValue(mockStrategy),
    } as unknown as PaymentStrategyRegistry;

    mockEventBus = {
      publish: vi.fn(),
    } as unknown as EventBus;

    handler = new ProcessWebhookCommandHandler(
      mockPaymentRepo,
      mockStrategyRegistry,
      mockEventBus,
    );
  });

  it('should mark payment completed and publish PaymentCompletedIntegrationEvent on successful webhook', async () => {
    const payment = Payment.create({
      orderId,
      provider: PaymentProvider.stripe(),
      amount: Money.fromCents(5000, 'USD'),
    });
    payment.assignTransactionId('pi_test_123');

    vi.mocked(mockPaymentRepo.findByTransactionId).mockResolvedValue(payment);

    const result = await handler.execute(
      new ProcessWebhookCommand({
        provider: 'stripe',
        rawBody: '{"id": "evt_test_123"}',
        headers: { 'stripe-signature': 'sig_123' },
        query: {},
        body: {},
      }),
    );

    expect(result.received).toBe(true);
    expect(result.processed).toBe(true);
    expect(payment.status.isCompleted()).toBe(true);
    expect(mockPaymentRepo.save).toHaveBeenCalledWith(payment);
    expect(mockEventBus.publish).toHaveBeenCalledWith(
      expect.any(PaymentCompletedIntegrationEvent),
    );
  });

  it('should mark payment as needs_review if received amount mismatches expected amount', async () => {
    const payment = Payment.create({
      orderId,
      provider: PaymentProvider.stripe(),
      amount: Money.fromCents(5000, 'USD'), // Expects $50
    });
    payment.assignTransactionId('pi_test_123');

    vi.mocked(mockPaymentRepo.findByTransactionId).mockResolvedValue(payment);

    // Gateway reports $30 instead of $50
    vi.mocked(mockStrategy.verifyAndParseWebhook).mockResolvedValue({
      eventType: 'payment.succeeded',
      transactionId: 'pi_test_123',
      orderId,
      amount: Money.fromCents(3000, 'USD'),
      gatewayPayload: { id: 'evt_test_mismatch' },
    });

    const result = await handler.execute(
      new ProcessWebhookCommand({
        provider: 'stripe',
        rawBody: '{"id": "evt_test_mismatch"}',
        headers: { 'stripe-signature': 'sig_123' },
        query: {},
        body: {},
      }),
    );

    expect(result.received).toBe(true);
    expect(payment.status.isNeedsReview()).toBe(true);
    expect(mockEventBus.publish).not.toHaveBeenCalled();
  });

  it('should return processed=false if webhook event was already recorded (idempotency)', async () => {
    vi.mocked(mockPaymentRepo.processWebhookEventAtomic).mockResolvedValue(
      false,
    );

    const result = await handler.execute(
      new ProcessWebhookCommand({
        provider: 'stripe',
        rawBody: '{"id": "evt_test_duplicate"}',
        headers: { 'stripe-signature': 'sig_123' },
        query: {},
        body: {},
      }),
    );

    expect(result.received).toBe(true);
    expect(result.processed).toBe(false);
    expect(mockEventBus.publish).not.toHaveBeenCalled();
  });
});
