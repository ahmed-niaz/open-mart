import { describe, expect, it, vi, beforeEach } from 'vitest';
import { IdempotencyService } from '../../src/shared/infrastructure/idempotency/idempotency.service.js';
import { OutboxService } from '../../src/shared/infrastructure/outbox/outbox.service.js';
import { EventDeduplicationService } from '../../src/shared/infrastructure/outbox/event-deduplication.service.js';
import { deserializeOutboxEvent } from '../../src/shared/infrastructure/outbox/event-registry.js';
import { OrderCancelledEvent } from '../../src/order/domain/events/order-cancelled.event.js';
import {
  ApplicationException,
  ApplicationExceptionCode,
} from '../../src/shared/domain/exceptions/application.exception.js';

describe('Reliability Layer: Transactional Outbox & Idempotency Engine', () => {
  describe('Outbox Event Serialization & Deserialization', () => {
    it('should correctly register and deserialize known domain events', () => {
      const now = new Date();
      const rawPayload = {
        orderId: 'ord-12345',
        customerId: 'cust-67890',
        reason: 'Customer requested cancellation',
        occurredAt: now.toISOString(),
      };

      const event = deserializeOutboxEvent(
        'OrderCancelledEvent',
        rawPayload,
        'msg-uuid-1',
      );

      expect(event).toBeInstanceOf(OrderCancelledEvent);
      expect(event.orderId).toBe('ord-12345');
      expect(event.customerId).toBe('cust-67890');
      expect(event.reason).toBe('Customer requested cancellation');
      expect(event.eventId).toBe('msg-uuid-1');
      expect(event.occurredAt).toBeInstanceOf(Date);
      expect(event.occurredAt.getTime()).toBe(now.getTime());
    });

    it('should fall back to attaching eventId for unregistered domain events', () => {
      const rawPayload = { customField: 'test', amount: 500 };
      const event = deserializeOutboxEvent(
        'UnknownFutureEvent',
        rawPayload,
        'msg-uuid-2',
      );

      expect(event.customField).toBe('test');
      expect(event.amount).toBe(500);
      expect(event.eventId).toBe('msg-uuid-2');
      expect(event.__type).toBe('UnknownFutureEvent');
    });
  });

  describe('OutboxService Unit Logic', () => {
    let mockDb: any;
    let outboxService: OutboxService;

    beforeEach(() => {
      mockDb = {
        insert: vi.fn().mockReturnValue({
          values: vi.fn().mockResolvedValue([]),
        }),
        execute: vi.fn().mockResolvedValue([]),
        update: vi.fn().mockReturnValue({
          set: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([]),
          }),
        }),
      };
      outboxService = new OutboxService(mockDb);
    });

    it('should stage uncommitted events into outbox within the transaction', async () => {
      const mockTx = {
        insert: vi.fn().mockReturnValue({
          values: vi.fn().mockResolvedValue([]),
        }),
      };

      const event = new OrderCancelledEvent('ord-1', null, 'Cancelled by user');

      await outboxService.stageEvents(mockTx, 'Order', 'ord-1', [event]);

      expect(mockTx.insert).toHaveBeenCalledTimes(1);
    });

    it('should not insert into outbox if events array is empty', async () => {
      const mockTx = {
        insert: vi.fn(),
      };

      await outboxService.stageEvents(mockTx, 'Order', 'ord-1', []);
      expect(mockTx.insert).not.toHaveBeenCalled();
    });

    it('should trigger sweep listener when triggerSweep is invoked', () => {
      vi.useFakeTimers();
      const listener = vi.fn();
      outboxService.onSweepTrigger(listener);

      outboxService.triggerSweep();
      vi.runAllTimers();

      expect(listener).toHaveBeenCalledTimes(1);
      vi.useRealTimers();
    });
  });

  describe('EventDeduplicationService Consumer Idempotency', () => {
    let mockDb: any;
    let dedupService: EventDeduplicationService;

    beforeEach(() => {
      mockDb = {
        select: vi.fn(),
        insert: vi.fn().mockReturnValue({
          values: vi.fn().mockResolvedValue([]),
        }),
      };
      dedupService = new EventDeduplicationService(mockDb);
    });

    it('should execute handler function when event has not been processed', async () => {
      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]), // not found
          }),
        }),
      });

      const handlerFn = vi.fn().mockResolvedValue(undefined);
      await dedupService.executeIdempotently(
        'event-123',
        'TestOrderHandler',
        handlerFn,
      );

      expect(handlerFn).toHaveBeenCalledTimes(1);
      expect(mockDb.insert).toHaveBeenCalledTimes(1);
    });

    it('should skip handler execution when event was already processed', async () => {
      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([{ eventId: 'event-123' }]), // already processed
          }),
        }),
      });

      const handlerFn = vi.fn().mockResolvedValue(undefined);
      await dedupService.executeIdempotently(
        'event-123',
        'TestOrderHandler',
        handlerFn,
      );

      expect(handlerFn).not.toHaveBeenCalled();
      expect(mockDb.insert).not.toHaveBeenCalled();
    });

    it('should gracefully execute if eventId is missing (e.g. unit tests)', async () => {
      const handlerFn = vi.fn().mockResolvedValue(undefined);
      await dedupService.executeIdempotently(
        undefined,
        'TestOrderHandler',
        handlerFn,
      );

      expect(handlerFn).toHaveBeenCalledTimes(1);
    });
  });

  describe('IdempotencyService Logic & Constraints', () => {
    let mockDb: any;
    let idempotencyService: IdempotencyService;

    beforeEach(() => {
      mockDb = {
        select: vi.fn(),
        insert: vi.fn().mockReturnValue({
          values: vi.fn().mockReturnValue({
            onConflictDoUpdate: vi.fn().mockResolvedValue([]),
          }),
        }),
      };
      idempotencyService = new IdempotencyService(mockDb);
    });

    it('should compute consistent hash regardless of JSON key ordering', () => {
      const payloadA = { b: 2, a: 1, c: { y: 'hello', x: 'world' } };
      const payloadB = { a: 1, c: { x: 'world', y: 'hello' }, b: 2 };

      const hashA = idempotencyService.computeHash(payloadA);
      const hashB = idempotencyService.computeHash(payloadB);

      expect(hashA).toBe(hashB);
      expect(hashA.length).toBe(64); // SHA-256
    });

    it('should return cached response if key, scope, path, and payload hash match', async () => {
      const payload = { amount: 1000, items: ['SKU-1'] };
      const hash = idempotencyService.computeHash(payload);

      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([
              {
                key: 'idemp-key-1',
                scope: 'user:123',
                requestPath: '/api/orders',
                requestHash: hash,
                status: 'completed',
                responseCode: 201,
                responseBody: { orderId: 'ord-100' },
                createdAt: new Date(),
                expiresAt: new Date(Date.now() + 86400000),
              },
            ]),
          }),
        }),
      });

      const result = await idempotencyService.checkKey(
        'idemp-key-1',
        'user:123',
        '/api/orders',
        payload,
      );

      expect(result.cached).toBe(true);
      expect(result.responseCode).toBe(201);
      expect(result.responseBody).toEqual({ orderId: 'ord-100' });
    });

    it('should throw 422 Unprocessable Entity if idempotency key is reused with different payload', async () => {
      const oldPayload = { amount: 1000 };
      const newPayload = { amount: 2000 }; // changed amount!
      const oldHash = idempotencyService.computeHash(oldPayload);

      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([
              {
                key: 'idemp-key-1',
                scope: 'user:123',
                requestPath: '/api/orders',
                requestHash: oldHash,
                status: 'completed',
                responseCode: 201,
                responseBody: { orderId: 'ord-100' },
                createdAt: new Date(),
                expiresAt: new Date(Date.now() + 86400000),
              },
            ]),
          }),
        }),
      });

      await expect(
        idempotencyService.checkKey(
          'idemp-key-1',
          'user:123',
          '/api/orders',
          newPayload,
        ),
      ).rejects.toThrow(ApplicationException);

      try {
        await idempotencyService.checkKey(
          'idemp-key-1',
          'user:123',
          '/api/orders',
          newPayload,
        );
      } catch (err: any) {
        expect(err.code).toBe(ApplicationExceptionCode.UNPROCESSABLE_ENTITY);
        expect(err.message).toContain('different request payload');
      }
    });

    it('should throw 409 Conflict if request with same key is currently in progress', async () => {
      const payload = { amount: 1000 };
      const hash = idempotencyService.computeHash(payload);

      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([
              {
                key: 'idemp-key-1',
                scope: 'user:123',
                requestPath: '/api/orders',
                requestHash: hash,
                status: 'in_progress',
                createdAt: new Date(), // recent
                expiresAt: new Date(Date.now() + 86400000),
              },
            ]),
          }),
        }),
      });

      await expect(
        idempotencyService.checkKey(
          'idemp-key-1',
          'user:123',
          '/api/orders',
          payload,
        ),
      ).rejects.toThrow(ApplicationException);

      try {
        await idempotencyService.checkKey(
          'idemp-key-1',
          'user:123',
          '/api/orders',
          payload,
        );
      } catch (err: any) {
        expect(err.code).toBe(ApplicationExceptionCode.CONFLICT);
        expect(err.message).toContain('currently being processed');
      }
    });
  });
});
