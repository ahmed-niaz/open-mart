import { describe, expect, it, vi, beforeEach } from 'vitest';
import { Reflector } from '@nestjs/core';
import type { CommandBus, QueryBus } from '@nestjs/cqrs';

import { InventoryAdminController } from '../../src/inventory/presentation/controllers/inventory-admin.controller.js';
import { GetInventorySummaryQuery } from '../../src/inventory/application/queries/get-inventory-summary/get-inventory-summary.query.js';
import { GetInventorySummaryQueryHandler } from '../../src/inventory/application/queries/get-inventory-summary/get-inventory-summary.handler.js';
import { ListAllMovementsQuery } from '../../src/inventory/application/queries/list-all-movements/list-all-movements.query.js';
import { AdminPermission } from '../../src/shared/infrastructure/guards/admin-permissions.js';
import { PERMISSIONS_KEY } from '../../src/shared/presentation/decorators/require-permissions.decorator.js';

describe('Inventory Admin Dashboard Unit Tests', () => {
  const reflector = new Reflector();

  describe('InventoryAdminController RBAC Permissions', () => {
    it('declares INVENTORY_READ on getInventorySummary route', () => {
      const perms = reflector.get<AdminPermission[]>(
        PERMISSIONS_KEY,
        InventoryAdminController.prototype.getInventorySummary,
      );
      expect(perms).toEqual([AdminPermission.INVENTORY_READ]);
    });

    it('declares INVENTORY_READ on listAllMovements route', () => {
      const perms = reflector.get<AdminPermission[]>(
        PERMISSIONS_KEY,
        InventoryAdminController.prototype.listAllMovements,
      );
      expect(perms).toEqual([AdminPermission.INVENTORY_READ]);
    });

    it('declares INVENTORY_READ on listInventory route', () => {
      const perms = reflector.get<AdminPermission[]>(
        PERMISSIONS_KEY,
        InventoryAdminController.prototype.listInventory,
      );
      expect(perms).toEqual([AdminPermission.INVENTORY_READ]);
    });
  });

  describe('InventoryAdminController Query Delegation', () => {
    let controller: InventoryAdminController;
    let mockCommandBus: CommandBus;
    let mockQueryBus: QueryBus;

    beforeEach(() => {
      mockCommandBus = { execute: vi.fn() } as unknown as CommandBus;
      mockQueryBus = { execute: vi.fn() } as unknown as QueryBus;
      controller = new InventoryAdminController(mockCommandBus, mockQueryBus);
    });

    it('delegates summary query to QueryBus', async () => {
      const mockSummary = {
        totalSkus: 20,
        inStockSkus: 15,
        lowStockSkus: 3,
        outOfStockSkus: 2,
        totalUnitsOnHand: 500,
        totalUnitsReserved: 20,
        totalUnitsAvailable: 480,
        estimatedRetailValueCents: 500000,
        estimatedRetailValueBDT: 5000,
      };
      vi.mocked(mockQueryBus.execute).mockResolvedValueOnce(mockSummary);

      const res = await controller.getInventorySummary();
      expect(mockQueryBus.execute).toHaveBeenCalledWith(
        expect.any(GetInventorySummaryQuery),
      );
      expect(res).toEqual({ data: mockSummary });
    });

    it('delegates all movements query to QueryBus and formats pagination envelope', async () => {
      const mockResult = {
        movements: [
          {
            id: 'mov-1',
            sku: 'SKU-001',
            productTitle: 'Premium Coffee',
            reason: 'restock',
            type: 'restock',
            onHandDelta: 50,
            reservedDelta: 0,
            quantityDelta: 50,
            balanceAfter: 150,
            onHandAfter: 150,
            reservedAfter: 0,
            actorId: 'admin-1',
            referenceType: 'PO',
            referenceId: 'PO-100',
            note: 'Initial batch',
            createdAt: new Date(),
          },
        ],
        total: 1,
        page: 1,
        limit: 20,
        totalPages: 1,
      };
      vi.mocked(mockQueryBus.execute).mockResolvedValueOnce(mockResult);

      const res = await controller.listAllMovements(1, 20);
      expect(mockQueryBus.execute).toHaveBeenCalledWith(
        new ListAllMovementsQuery(1, 20, undefined),
      );
      expect(res.data).toHaveLength(1);
      expect(res.meta.total).toBe(1);
    });
  });

  describe('GetInventorySummaryQueryHandler', () => {
    it('executes SQL projection and computes valuation', async () => {
      const mockDb: any = {
        select: vi.fn().mockReturnThis(),
        from: vi.fn().mockReturnThis(),
        leftJoin: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue([
          {
            totalSkus: 10,
            inStockSkus: 7,
            lowStockSkus: 2,
            outOfStockSkus: 1,
            totalUnitsOnHand: 300,
            totalUnitsReserved: 15,
            totalUnitsAvailable: 285,
            estimatedRetailValueCents: '250000',
          },
        ]),
      };

      const handler = new GetInventorySummaryQueryHandler(mockDb);
      const result = await handler.execute();

      expect(result.totalSkus).toBe(10);
      expect(result.inStockSkus).toBe(7);
      expect(result.lowStockSkus).toBe(2);
      expect(result.outOfStockSkus).toBe(1);
      expect(result.totalUnitsOnHand).toBe(300);
      expect(result.totalUnitsReserved).toBe(15);
      expect(result.totalUnitsAvailable).toBe(285);
      expect(result.estimatedRetailValueCents).toBe(250000);
      expect(result.estimatedRetailValueBDT).toBe(2500);
    });
  });
});
