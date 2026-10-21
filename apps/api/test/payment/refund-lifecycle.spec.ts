import { describe, expect, it, vi, beforeEach } from 'vitest';
import { Payment } from '../../src/payment/domain/entities/payment.entity.js';
import { PaymentProvider } from '../../src/payment/domain/value-objects/payment-provider.vo.js';
import { Money } from '../../src/shared/domain/value-objects/money.vo.js';
import { DomainException } from '../../src/shared/domain/exceptions/domain.exception.js';
import { PaymentRefundInitiatedEvent } from '../../src/payment/domain/events/payment-refund-initiated.event.js';
import { PaymentRefundedEvent } from '../../src/payment/domain/events/payment-refunded.event.js';
import { PaymentRefundFailedEvent } from '../../src/payment/domain/events/payment-refund-failed.event.js';
import { RefundPaymentCommandHandler } from '../../src/payment/application/use-cases/refund-payment/refund-payment.handler.js';
import { RefundPaymentCommand } from '../../src/payment/application/use-cases/refund-payment/refund-payment.command.js';
import type { PaymentRepositoryPort } from '../../src/payment/application/ports/payment.repository.js';
import type { PaymentStrategyRegistry } from '../../src/payment/infrastructure/strategies/payment-strategy.registry.js';
import type { PaymentGatewayStrategy } from '../../src/payment/application/ports/payment-gateway-strategy.port.js';
import { OrderCancelledPaymentHandler } from '../../src/payment/application/event-handlers/order-cancelled.event-handler.js';
import { OrderCancelledEvent } from '../../src/order/domain/events/order-cancelled.event.js';

describe('Payment Two-Phase Refund Engine', () => {
  const orderId = '00000000-0000-0000-0000-000000000001';
  const totalAmount = Money.fromCents(10000, 'BDT'); // ৳100.00

  function createCompletedPayment(
    provider = PaymentProvider.stripe(),
  ): Payment {
    const payment = Payment.create({
      orderId,
      customerId: 'cust-1',
      provider,
      amount: totalAmount,
      transactionId: 'txn-12345',
    });
    payment.complete('txn-12345');
    payment.clearEvents();
    return payment;
  }

  describe('Payment Aggregate Refund Transitions', () => {
    it('initiates a refund: sets refund_pending, creates pending refund, and emits PaymentRefundInitiatedEvent', () => {
      const payment = createCompletedPayment();
      const refundAmount = Money.fromCents(4000, 'BDT'); // ৳40.00

      const refund = payment.initiateRefund({
        amount: refundAmount,
        reason: 'Customer requested return of 1 item',
        initiatedBy: 'admin:usr-1',
      });

      expect(payment.status.getValue()).toBe('refund_pending');
      expect(refund.status).toBe('pending');
      expect(refund.amount.toCents()).toBe(4000);
      expect(refund.reason).toBe('Customer requested return of 1 item');
      expect(payment.refunds.length).toBe(1);

      const events = payment.getUncommittedEvents();
      expect(events.length).toBe(1);
      expect(events[0]).toBeInstanceOf(PaymentRefundInitiatedEvent);
      const initEvent = events[0] as PaymentRefundInitiatedEvent;
      expect(initEvent.refundAmountCents).toBe(4000);
      expect(initEvent.currency).toBe('BDT');
      expect(initEvent.reason).toBe('Customer requested return of 1 item');
    });

    it('rejects initiating refund if payment is not completed or already refunding', () => {
      const pendingPayment = Payment.create({
        orderId,
        provider: PaymentProvider.stripe(),
        amount: totalAmount,
      });

      expect(() =>
        pendingPayment.initiateRefund({
          amount: Money.fromCents(1000, 'BDT'),
          reason: 'Premature refund',
          initiatedBy: 'admin:1',
        }),
      ).toThrow(DomainException);

      const completedPayment = createCompletedPayment();
      completedPayment.initiateRefund({
        amount: Money.fromCents(1000, 'BDT'),
        reason: 'First refund',
        initiatedBy: 'admin:1',
      });

      // Second concurrent initiation while one is already pending
      expect(() =>
        completedPayment.initiateRefund({
          amount: Money.fromCents(1000, 'BDT'),
          reason: 'Second concurrent refund',
          initiatedBy: 'admin:1',
        }),
      ).toThrow(DomainException);
    });

    it('rejects refund if amount exceeds remaining refundable balance', () => {
      const payment = createCompletedPayment();

      expect(() =>
        payment.initiateRefund({
          amount: Money.fromCents(10001, 'BDT'), // exceeds 10,000
          reason: 'Excessive refund',
          initiatedBy: 'admin:1',
        }),
      ).toThrow(DomainException);
    });

    it('completes a partial refund: transitions to partially_refunded and updates ledger', () => {
      const payment = createCompletedPayment();
      const refund = payment.initiateRefund({
        amount: Money.fromCents(3000, 'BDT'),
        reason: 'Damaged item return',
        initiatedBy: 'admin:1',
      });
      payment.clearEvents();

      payment.completeRefund(refund.id, 're_stripe_001');

      expect(payment.status.getValue()).toBe('partially_refunded');
      expect(payment.refundedAmount.toCents()).toBe(3000);
      expect(refund.status).toBe('completed');
      expect(refund.gatewayRefundId).toBe('re_stripe_001');

      const events = payment.getUncommittedEvents();
      expect(events.length).toBe(1);
      expect(events[0]).toBeInstanceOf(PaymentRefundedEvent);
      const refundedEvent = events[0] as PaymentRefundedEvent;
      expect(refundedEvent.isFullRefund).toBe(false);
      expect(refundedEvent.refundAmountCents).toBe(3000);
      expect(refundedEvent.totalRefundedCents).toBe(3000);
    });

    it('completes multiple partial refunds until full refund is achieved', () => {
      const payment = createCompletedPayment();

      // First partial refund (৳30.00)
      const r1 = payment.initiateRefund({
        amount: Money.fromCents(3000, 'BDT'),
        reason: 'Partial return 1',
        initiatedBy: 'admin:1',
      });
      payment.completeRefund(r1.id, 're_1');
      expect(payment.status.getValue()).toBe('partially_refunded');

      // Second partial refund (remaining ৳70.00)
      const r2 = payment.initiateRefund({
        amount: Money.fromCents(7000, 'BDT'),
        reason: 'Partial return 2',
        initiatedBy: 'admin:1',
      });
      payment.completeRefund(r2.id, 're_2');

      expect(payment.status.getValue()).toBe('refunded');
      expect(payment.refundedAmount.toCents()).toBe(10000);
      expect(payment.refunds.length).toBe(2);
    });

    it('fails a refund: transitions to refund_failed and allows retry', () => {
      const payment = createCompletedPayment();
      const refund = payment.initiateRefund({
        amount: Money.fromCents(5000, 'BDT'),
        reason: 'Attempted refund',
        initiatedBy: 'admin:1',
      });
      payment.clearEvents();

      payment.failRefund(refund.id, 'Card expired or closed');

      expect(payment.status.getValue()).toBe('refund_failed');
      expect(refund.status).toBe('failed');
      expect(refund.failureReason).toBe('Card expired or closed');

      const events = payment.getUncommittedEvents();
      expect(events.length).toBe(1);
      expect(events[0]).toBeInstanceOf(PaymentRefundFailedEvent);

      // Now retry refund
      const retryRefund = payment.initiateRefund({
        amount: Money.fromCents(5000, 'BDT'),
        reason: 'Retry to bank account',
        initiatedBy: 'admin:1',
      });
      expect(payment.status.getValue()).toBe('refund_pending');
      payment.completeRefund(retryRefund.id, 're_retry_001');
      expect(payment.status.getValue()).toBe('partially_refunded');
    });
  });

  describe('RefundPaymentCommandHandler', () => {
    let mockPaymentRepo: Partial<PaymentRepositoryPort>;
    let mockStrategy: Partial<PaymentGatewayStrategy>;
    let mockStrategyRegistry: Partial<PaymentStrategyRegistry>;

    beforeEach(() => {
      mockPaymentRepo = {
        findById: vi.fn(),
        save: vi.fn().mockResolvedValue(undefined),
      };

      mockStrategy = {
        refund: vi.fn().mockResolvedValue({
          refundId: 're_gateway_999',
          status: 'completed',
        }),
      };

      mockStrategyRegistry = {
        getStrategy: vi.fn().mockReturnValue(mockStrategy),
      };
    });

    it('successfully processes an online gateway refund', () => {
      const payment = createCompletedPayment(PaymentProvider.stripe());
      (mockPaymentRepo.findById as any).mockResolvedValue(payment);

      const handler = new RefundPaymentCommandHandler(
        mockPaymentRepo as PaymentRepositoryPort,
        mockStrategyRegistry as PaymentStrategyRegistry,
      );

      return handler
        .execute(
          new RefundPaymentCommand(
            payment.id.getValue(),
            5000,
            'Defective item',
            'admin:1',
          ),
        )
        .then((result) => {
          expect(result.status).toBe('completed');
          expect(result.gatewayRefundId).toBe('re_gateway_999');
          expect(result.amountCents).toBe(5000);
          expect(payment.refundedAmount.toCents()).toBe(5000);
          expect(payment.status.getValue()).toBe('partially_refunded');
          expect(mockStrategy.refund).toHaveBeenCalledTimes(1);
        });
    });

    it('processes a manual offline refund for Cash on Delivery without calling online gateway', () => {
      const payment = createCompletedPayment(PaymentProvider.cod());
      (mockPaymentRepo.findById as any).mockResolvedValue(payment);

      const handler = new RefundPaymentCommandHandler(
        mockPaymentRepo as PaymentRepositoryPort,
        mockStrategyRegistry as PaymentStrategyRegistry,
      );

      return handler
        .execute(
          new RefundPaymentCommand(
            payment.id.getValue(),
            10000,
            'Returned COD order',
            'admin:1',
            true,
            'BKASH-TRX-987654',
          ),
        )
        .then((result) => {
          expect(result.status).toBe('completed');
          expect(result.isOfflinePayout).toBe(true);
          expect(result.gatewayRefundId).toBe('BKASH-TRX-987654');
          expect(payment.status.getValue()).toBe('refunded');
          expect(mockStrategy.refund).not.toHaveBeenCalled();
        });
    });

    it('handles gateway failure properly by marking refund as failed in aggregate', () => {
      const payment = createCompletedPayment(PaymentProvider.stripe());
      (mockPaymentRepo.findById as any).mockResolvedValue(payment);

      (mockStrategy.refund as any).mockResolvedValue({
        refundId: '',
        status: 'failed',
        failureReason: 'Insufficient gateway merchant balance',
      });

      const handler = new RefundPaymentCommandHandler(
        mockPaymentRepo as PaymentRepositoryPort,
        mockStrategyRegistry as PaymentStrategyRegistry,
      );

      return handler
        .execute(
          new RefundPaymentCommand(
            payment.id.getValue(),
            2000,
            'Customer cancellation',
            'admin:1',
          ),
        )
        .then((result) => {
          expect(result.status).toBe('failed');
          expect(result.failureReason).toBe(
            'Insufficient gateway merchant balance',
          );
          expect(payment.status.getValue()).toBe('refund_failed');
        });
    });
  });

  describe('OrderCancelledPaymentHandler Integration', () => {
    it('dispatches auto-refund command when pre-shipment cancelled order had a completed payment', async () => {
      const payment = createCompletedPayment(PaymentProvider.stripe());
      const mockPaymentRepo = {
        findByOrderId: vi.fn().mockResolvedValue(payment),
        save: vi.fn().mockResolvedValue(undefined),
      };

      const mockCommandBus = {
        execute: vi.fn().mockResolvedValue({ status: 'completed' }),
      };

      const mockEventBus = {
        publish: vi.fn(),
      };

      const mockEventDeduplication = {
        executeIdempotently: vi
          .fn()
          .mockImplementation((_id, _name, fn) => fn()),
      };

      const handler = new OrderCancelledPaymentHandler(
        mockPaymentRepo as any,
        mockCommandBus as any,
        mockEventBus as any,
        mockEventDeduplication as any,
      );

      await handler.handle(
        new OrderCancelledEvent(
          orderId,
          'cust-1',
          'Customer requested cancellation before shipment',
        ),
      );

      expect(mockCommandBus.execute).toHaveBeenCalledTimes(1);
      const dispatchedCommand = mockCommandBus.execute.mock.calls[0][0];
      expect(dispatchedCommand).toBeInstanceOf(RefundPaymentCommand);
      expect(dispatchedCommand.amountCents).toBe(10000);
      expect(dispatchedCommand.reason).toContain(
        'Auto-refund: order cancelled pre-shipment',
      );
    });

    it('cancels pending payment directly without refund when order is cancelled before payment was made', async () => {
      const payment = Payment.create({
        orderId,
        provider: PaymentProvider.stripe(),
        amount: totalAmount,
      });

      const mockPaymentRepo = {
        findByOrderId: vi.fn().mockResolvedValue(payment),
        save: vi.fn().mockResolvedValue(undefined),
      };

      const mockCommandBus = {
        execute: vi.fn(),
      };

      const mockEventBus = {
        publish: vi.fn(),
      };

      const mockEventDeduplication = {
        executeIdempotently: vi
          .fn()
          .mockImplementation((_id, _name, fn) => fn()),
      };

      const handler = new OrderCancelledPaymentHandler(
        mockPaymentRepo as any,
        mockCommandBus as any,
        mockEventBus as any,
        mockEventDeduplication as any,
      );

      await handler.handle(
        new OrderCancelledEvent(
          orderId,
          'cust-1',
          'Customer abandoned checkout',
        ),
      );

      expect(payment.status.getValue()).toBe('cancelled');
      expect(mockCommandBus.execute).not.toHaveBeenCalled();
      expect(mockPaymentRepo.save).toHaveBeenCalledWith(payment);
      expect(mockEventBus.publish).toHaveBeenCalledTimes(1);
    });
  });
});
