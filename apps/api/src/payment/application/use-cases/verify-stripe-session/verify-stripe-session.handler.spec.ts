import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CommandBus, EventBus } from '@nestjs/cqrs';
import { VerifyStripeSessionCommandHandler } from './verify-stripe-session.handler.js';
import { VerifyStripeSessionCommand } from './verify-stripe-session.command.js';
import { PaymentRepositoryPort } from '../../ports/payment.repository.js';
import { OrderPaymentPort } from '../../ports/order-payment.port.js';
import { StripePaymentStrategy } from '../../../infrastructure/strategies/stripe.strategy.js';
import { Money } from '../../../../shared/domain/value-objects/money.vo.js';
import { Payment } from '../../../domain/entities/payment.entity.js';
import { PaymentProvider } from '../../../domain/value-objects/payment-provider.vo.js';
import { PaymentCompletedIntegrationEvent } from '../../../../shared/contracts/events/payment-completed.event.js';
import { ApplicationException } from '../../../../shared/domain/exceptions/application.exception.js';

describe('VerifyStripeSessionCommandHandler', () => {
  let handler: VerifyStripeSessionCommandHandler;
  let mockPaymentRepo: PaymentRepositoryPort;
  let mockOrderPort: OrderPaymentPort;
  let mockStripeStrategy: StripePaymentStrategy;
  let mockEventBus: EventBus;
  let mockCommandBus: CommandBus;

  const orderId = crypto.randomUUID();
  const sessionId = 'cs_test_session_abc';

  beforeEach(() => {
    mockPaymentRepo = {
      save: vi.fn().mockResolvedValue(undefined),
      findById: vi.fn(),
      findByOrderId: vi.fn(),
      findByTransactionId: vi.fn(),
      findRefundsByPaymentId: vi.fn().mockResolvedValue([]),
      findRefundsByOrderId: vi.fn().mockResolvedValue([]),
      processWebhookEventAtomic: vi.fn(),
    };

    mockOrderPort = {
      getOrderForPayment: vi.fn(),
    };

    mockStripeStrategy = {
      retrieveSession: vi.fn().mockResolvedValue({
        id: sessionId,
        payment_status: 'paid',
        payment_intent: 'pi_test_intent_123',
        client_reference_id: orderId,
        metadata: { orderId },
      }),
    } as unknown as StripePaymentStrategy;

    mockEventBus = {
      publish: vi.fn(),
    } as unknown as EventBus;

    mockCommandBus = {
      execute: vi.fn().mockResolvedValue({}),
    } as unknown as CommandBus;

    handler = new VerifyStripeSessionCommandHandler(
      mockPaymentRepo,
      mockOrderPort,
      mockStripeStrategy,
      mockEventBus,
      mockCommandBus,
    );
  });

  it('should throw NOT_FOUND if Stripe returns null session', async () => {
    vi.mocked(mockStripeStrategy.retrieveSession).mockResolvedValue(null);

    await expect(
      handler.execute(new VerifyStripeSessionCommand('invalid_session')),
    ).rejects.toThrow(ApplicationException);
  });

  it('should complete payment, execute ConfirmOrderCommand, and publish event if session is paid', async () => {
    const payment = Payment.create({
      orderId,
      provider: PaymentProvider.stripe(),
      amount: Money.fromCents(2500, 'USD'),
    });
    payment.assignTransactionId(sessionId);

    vi.mocked(mockPaymentRepo.findByTransactionId).mockResolvedValue(payment);

    const result = await handler.execute(
      new VerifyStripeSessionCommand(sessionId),
    );

    expect(result.status).toBe('completed');
    expect(result.orderStatus).toBe('confirmed');
    expect(payment.status.isCompleted()).toBe(true);
    expect(mockPaymentRepo.save).toHaveBeenCalledWith(payment);
    expect(mockCommandBus.execute).toHaveBeenCalled();
    expect(mockEventBus.publish).toHaveBeenCalledWith(
      expect.any(PaymentCompletedIntegrationEvent),
    );
  });

  it('should be idempotent and not re-publish if payment already completed', async () => {
    const payment = Payment.create({
      orderId,
      provider: PaymentProvider.stripe(),
      amount: Money.fromCents(2500, 'USD'),
    });
    payment.assignTransactionId(sessionId);
    payment.complete('pi_already_done');

    vi.mocked(mockPaymentRepo.findByTransactionId).mockResolvedValue(payment);

    const result = await handler.execute(
      new VerifyStripeSessionCommand(sessionId),
    );

    expect(result.status).toBe('completed');
    expect(result.alreadyProcessed).toBe(true);
    expect(mockPaymentRepo.save).not.toHaveBeenCalled();
    expect(mockEventBus.publish).not.toHaveBeenCalled();
    expect(mockCommandBus.execute).toHaveBeenCalled();
  });
});
