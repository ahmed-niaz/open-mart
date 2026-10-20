import { describe, expect, it, vi, beforeEach } from 'vitest';
import { EventBus } from '@nestjs/cqrs';

import { CancelPaymentCommandHandler } from './cancel-payment.handler.js';
import { CancelPaymentCommand } from './cancel-payment.command.js';
import { Payment } from '../../../domain/entities/payment.entity.js';
import { PaymentProvider } from '../../../domain/value-objects/payment-provider.vo.js';
import { Money } from '../../../../shared/domain/value-objects/money.vo.js';
import { PaymentCancelledIntegrationEvent } from '../../../../shared/contracts/events/payment-cancelled.event.js';
import { ApplicationException } from '../../../../shared/domain/exceptions/application.exception.js';

describe('CancelPaymentCommandHandler', () => {
  let handler: CancelPaymentCommandHandler;
  let mockPaymentRepo: any;
  let mockEventBus: any;

  beforeEach(() => {
    mockPaymentRepo = {
      findByOrderId: vi.fn(),
      save: vi.fn(),
    };
    mockEventBus = {
      publish: vi.fn(),
    };

    handler = new CancelPaymentCommandHandler(
      mockPaymentRepo,
      mockEventBus as unknown as EventBus,
    );
  });

  it('should cancel an active pending payment and publish integration event', async () => {
    const payment = Payment.create({
      orderId: 'order-123',
      provider: PaymentProvider.stripe(),
      amount: Money.create(5000, 'USD'),
      metadata: {
        customerEmail: 'customer@example.com',
        customerName: 'John Doe',
      },
    });

    mockPaymentRepo.findByOrderId.mockResolvedValue(payment);

    const result = await handler.execute(
      new CancelPaymentCommand('order-123', 'Customer changed their mind'),
    );

    expect(result.status).toBe('cancelled');
    expect(result.orderId).toBe('order-123');
    expect(mockPaymentRepo.save).toHaveBeenCalled();
    expect(mockEventBus.publish).toHaveBeenCalledWith(
      expect.any(PaymentCancelledIntegrationEvent),
    );
    const event = mockEventBus.publish.mock.calls[0][0];
    expect(event.customerEmail).toBe('customer@example.com');
    expect(event.customerName).toBe('John Doe');
  });

  it('should throw NOT_FOUND if payment is not found', async () => {
    mockPaymentRepo.findByOrderId.mockResolvedValue(null);

    await expect(
      handler.execute(new CancelPaymentCommand('non-existent-order')),
    ).rejects.toThrow(ApplicationException);
  });

  it('should throw CONFLICT if payment is already completed', async () => {
    const payment = Payment.create({
      orderId: 'order-456',
      provider: PaymentProvider.sslcommerz(),
      amount: Money.create(3000, 'USD'),
    });
    payment.complete('txn-123');

    mockPaymentRepo.findByOrderId.mockResolvedValue(payment);

    await expect(
      handler.execute(new CancelPaymentCommand('order-456')),
    ).rejects.toThrow(ApplicationException);
  });
});
