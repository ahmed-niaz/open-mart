import { describe, expect, it, vi, beforeEach } from 'vitest';
import { EventBus } from '@nestjs/cqrs';

import { ReserveStockCommandHandler } from '../../src/inventory/application/commands/reserve-stock/reserve-stock.handler.js';
import { ReserveStockCommand } from '../../src/inventory/application/commands/reserve-stock/reserve-stock.command.js';
import { CommitStockCommandHandler } from '../../src/inventory/application/commands/commit-stock/commit-stock.handler.js';
import { CommitStockCommand } from '../../src/inventory/application/commands/commit-stock/commit-stock.command.js';
import { ReleaseStockCommandHandler } from '../../src/inventory/application/commands/release-stock/release-stock.handler.js';
import { ReleaseStockCommand } from '../../src/inventory/application/commands/release-stock/release-stock.command.js';
import { ReverseStockCommandHandler } from '../../src/inventory/application/commands/reverse-stock/reverse-stock.handler.js';
import { ReverseStockCommand } from '../../src/inventory/application/commands/reverse-stock/reverse-stock.command.js';
import { RestockCommandHandler } from '../../src/inventory/application/commands/restock/restock.handler.js';
import { RestockCommand } from '../../src/inventory/application/commands/restock/restock.command.js';
import { AdjustStockCommandHandler } from '../../src/inventory/application/commands/adjust-stock/adjust-stock.handler.js';
import { AdjustStockCommand } from '../../src/inventory/application/commands/adjust-stock/adjust-stock.command.js';
import { StocktakeCommandHandler } from '../../src/inventory/application/commands/stocktake/stocktake.handler.js';
import { StocktakeCommand } from '../../src/inventory/application/commands/stocktake/stocktake.command.js';
import { GetAvailabilityQueryHandler } from '../../src/inventory/application/queries/get-availability/get-availability.handler.js';
import { GetAvailabilityQuery } from '../../src/inventory/application/queries/get-availability/get-availability.query.js';

describe('Inventory Application Handlers', () => {
  let mockEventBus: any;

  beforeEach(() => {
    mockEventBus = {
      publish: vi.fn(),
    };
  });

  describe('ReserveStockCommandHandler', () => {
    it('should delegate reservation to port with TTL', async () => {
      const mockPort = {
        reserveStock: vi.fn().mockResolvedValue(undefined),
        checkAvailability: vi.fn(),
      };

      const handler = new ReserveStockCommandHandler(mockPort);
      await handler.execute(
        new ReserveStockCommand('ord-1', [{ sku: 'MUG-001', quantity: 2 }], 30),
      );

      expect(mockPort.reserveStock).toHaveBeenCalledWith(
        'ord-1',
        [{ sku: 'MUG-001', quantity: 2 }],
        30,
      );
    });
  });

  describe('CommitStockCommandHandler', () => {
    it('should commit reservations and publish StockCommittedEvent', async () => {
      const mockReservationRepo = {
        findByOrderId: vi.fn(),
        save: vi.fn(),
        commitForOrder: vi
          .fn()
          .mockResolvedValue([{ sku: 'MUG-001', quantity: 2, newOnHand: 18 }]),
        releaseForOrder: vi.fn(),
        reverseForOrder: vi.fn(),
      };

      const handler = new CommitStockCommandHandler(
        mockReservationRepo,
        mockEventBus as unknown as EventBus,
      );

      await handler.execute(new CommitStockCommand('ord-1'));

      expect(mockReservationRepo.commitForOrder).toHaveBeenCalledWith('ord-1');
      expect(mockEventBus.publish).toHaveBeenCalledTimes(1);
    });
  });

  describe('ReleaseStockCommandHandler', () => {
    it('should release uncommitted reservations and publish StockReleasedEvent', async () => {
      const mockReservationRepo = {
        findByOrderId: vi.fn(),
        save: vi.fn(),
        commitForOrder: vi.fn(),
        releaseForOrder: vi
          .fn()
          .mockResolvedValue([{ sku: 'MUG-001', quantity: 2 }]),
        reverseForOrder: vi.fn(),
      };

      const handler = new ReleaseStockCommandHandler(
        mockReservationRepo,
        mockEventBus as unknown as EventBus,
      );

      await handler.execute(
        new ReleaseStockCommand('ord-1', 'Payment cancelled by customer'),
      );

      expect(mockReservationRepo.releaseForOrder).toHaveBeenCalledWith(
        'ord-1',
        'Payment cancelled by customer',
      );
      expect(mockEventBus.publish).toHaveBeenCalledTimes(1);
    });
  });

  describe('ReverseStockCommandHandler', () => {
    it('should reverse committed reservations (restock) on post-confirmation cancellation', async () => {
      const mockReservationRepo = {
        findByOrderId: vi.fn(),
        save: vi.fn(),
        commitForOrder: vi.fn(),
        releaseForOrder: vi.fn(),
        reverseForOrder: vi
          .fn()
          .mockResolvedValue([{ sku: 'MUG-001', quantity: 2, newOnHand: 20 }]),
      };

      const handler = new ReverseStockCommandHandler(
        mockReservationRepo,
        mockEventBus as unknown as EventBus,
      );

      await handler.execute(
        new ReverseStockCommand('ord-1', 'Order cancelled after payment'),
      );

      expect(mockReservationRepo.reverseForOrder).toHaveBeenCalledWith(
        'ord-1',
        'Order cancelled after payment',
      );
      expect(mockEventBus.publish).toHaveBeenCalledTimes(1);
    });
  });

  describe('RestockCommandHandler', () => {
    it('should add physical inventory and publish StockRestockedEvent', async () => {
      const mockInventoryRepo = {
        findBySku: vi.fn(),
        findByProductId: vi.fn(),
        save: vi.fn(),
        atomicRestock: vi.fn().mockResolvedValue({ newOnHand: 50 }),
        atomicAdjust: vi.fn(),
        atomicStocktake: vi.fn(),
      };

      const handler = new RestockCommandHandler(
        mockInventoryRepo,
        mockEventBus as unknown as EventBus,
      );

      const result = await handler.execute(
        new RestockCommand(
          'MUG-001',
          20,
          'admin-user',
          'Inbound shipment #101',
        ),
      );

      expect(result.newOnHand).toBe(50);
      expect(result.quantityAdded).toBe(20);
      expect(mockInventoryRepo.atomicRestock).toHaveBeenCalledWith(
        'MUG-001',
        20,
        'admin-user',
        'Inbound shipment #101',
      );
      expect(mockEventBus.publish).toHaveBeenCalledTimes(1);
    });
  });

  describe('AdjustStockCommandHandler', () => {
    it('should adjust physical stock for damaged goods', async () => {
      const mockInventoryRepo = {
        findBySku: vi.fn(),
        findByProductId: vi.fn(),
        save: vi.fn(),
        atomicRestock: vi.fn(),
        atomicAdjust: vi.fn().mockResolvedValue({ newOnHand: 48 }),
        atomicStocktake: vi.fn(),
      };

      const handler = new AdjustStockCommandHandler(
        mockInventoryRepo,
        mockEventBus as unknown as EventBus,
      );

      const result = await handler.execute(
        new AdjustStockCommand(
          'MUG-001',
          -2,
          'damaged',
          'admin-user',
          'Broken mug',
        ),
      );

      expect(result.newOnHand).toBe(48);
      expect(result.delta).toBe(-2);
      expect(mockInventoryRepo.atomicAdjust).toHaveBeenCalledWith(
        'MUG-001',
        -2,
        'damaged',
        'admin-user',
        'Broken mug',
      );
    });
  });

  describe('StocktakeCommandHandler', () => {
    it('should set warehouse counted physical quantity and compute delta', async () => {
      const mockInventoryRepo = {
        findBySku: vi.fn(),
        findByProductId: vi.fn(),
        save: vi.fn(),
        atomicRestock: vi.fn(),
        atomicAdjust: vi.fn(),
        atomicStocktake: vi
          .fn()
          .mockResolvedValue({ delta: -3, newOnHand: 45 }),
      };

      const handler = new StocktakeCommandHandler(
        mockInventoryRepo,
        mockEventBus as unknown as EventBus,
      );

      const result = await handler.execute(
        new StocktakeCommand(
          'MUG-001',
          45,
          'admin-user',
          'Annual physical stocktake',
        ),
      );

      expect(result.countedQuantity).toBe(45);
      expect(result.delta).toBe(-3);
      expect(result.newOnHand).toBe(45);
    });
  });

  describe('GetAvailabilityQueryHandler', () => {
    it('should return categorized stock statuses for public storefront', async () => {
      const mockPort = {
        reserveStock: vi.fn(),
        checkAvailability: vi.fn().mockResolvedValue(
          new Map([
            ['MUG-001', 'in_stock'],
            ['SHIRT-002', 'low_stock'],
            ['OUT-OF-STOCK-SKU', 'out_of_stock'],
          ]),
        ),
      };

      const handler = new GetAvailabilityQueryHandler(mockPort);
      const result = await handler.execute(
        new GetAvailabilityQuery(['MUG-001', 'SHIRT-002', 'OUT-OF-STOCK-SKU']),
      );

      expect(result['MUG-001']).toBe('in_stock');
      expect(result['SHIRT-002']).toBe('low_stock');
      expect(result['OUT-OF-STOCK-SKU']).toBe('out_of_stock');
    });
  });
});
