import { describe, expect, it, vi, beforeEach } from 'vitest';
import { Reflector } from '@nestjs/core';
import type { CommandBus, QueryBus } from '@nestjs/cqrs';

import { CustomerAdminController } from '../../src/customer/presentation/customer-admin.controller.js';
import { ListCustomerQueryDto } from '../../src/customer/presentation/dto/list-customer-query.dto.js';
import { ListAdminCustomersQuery } from '../../src/customer/application/queries/list-admin-customers/list-admin-customers.query.js';
import { GetAdminCustomerDetailsHandler } from '../../src/customer/application/queries/get-admin-customer-details/get-admin-customer-details.handler.js';
import { GetAdminCustomerDetailsQuery } from '../../src/customer/application/queries/get-admin-customer-details/get-admin-customer-details.query.js';
import { AdminPermission } from '../../src/shared/infrastructure/guards/admin-permissions.js';
import { PERMISSIONS_KEY } from '../../src/shared/presentation/decorators/require-permissions.decorator.js';

describe('CustomerAdminController & Queries Unit Tests', () => {
  const reflector = new Reflector();

  describe('CustomerAdminController RBAC Permissions', () => {
    it('declares CUSTOMERS_READ on list route', () => {
      const perms = reflector.get<AdminPermission[]>(
        PERMISSIONS_KEY,
        CustomerAdminController.prototype.list,
      );
      expect(perms).toEqual([AdminPermission.CUSTOMERS_READ]);
    });

    it('declares CUSTOMERS_READ on getById route', () => {
      const perms = reflector.get<AdminPermission[]>(
        PERMISSIONS_KEY,
        CustomerAdminController.prototype.getById,
      );
      expect(perms).toEqual([AdminPermission.CUSTOMERS_READ]);
    });

    it('declares CUSTOMERS_DEACTIVATE on activate route', () => {
      const perms = reflector.get<AdminPermission[]>(
        PERMISSIONS_KEY,
        CustomerAdminController.prototype.activate,
      );
      expect(perms).toEqual([AdminPermission.CUSTOMERS_DEACTIVATE]);
    });

    it('declares CUSTOMERS_DEACTIVATE on deactivate route', () => {
      const perms = reflector.get<AdminPermission[]>(
        PERMISSIONS_KEY,
        CustomerAdminController.prototype.deactivate,
      );
      expect(perms).toEqual([AdminPermission.CUSTOMERS_DEACTIVATE]);
    });
  });

  describe('CustomerAdminController Delegation', () => {
    let controller: CustomerAdminController;
    let mockCommandBus: CommandBus;
    let mockQueryBus: QueryBus;

    beforeEach(() => {
      mockCommandBus = { execute: vi.fn() } as unknown as CommandBus;
      mockQueryBus = { execute: vi.fn() } as unknown as QueryBus;
      controller = new CustomerAdminController(mockCommandBus, mockQueryBus);
    });

    it('delegates list query to QueryBus', async () => {
      vi.mocked(mockQueryBus.execute).mockResolvedValueOnce({
        data: [],
        meta: {},
      });
      await controller.list(
        Object.assign(new ListCustomerQueryDto(), {
          page: 1,
          limit: 10,
          search: 'test',
        }),
      );
      expect(mockQueryBus.execute).toHaveBeenCalledWith(
        expect.any(ListAdminCustomersQuery),
      );
    });

    it('delegates getById query to QueryBus and wraps in data envelope', async () => {
      const customerId = '00000000-0000-0000-0000-000000000001';
      vi.mocked(mockQueryBus.execute).mockResolvedValueOnce({ id: customerId });
      const result = await controller.getById(customerId);
      expect(mockQueryBus.execute).toHaveBeenCalledWith(
        new GetAdminCustomerDetailsQuery(customerId),
      );
      expect(result).toEqual({ data: { id: customerId } });
    });

    it('delegates activate and deactivate to CommandBus', async () => {
      const customerId = '00000000-0000-0000-0000-000000000001';
      await controller.activate(customerId);
      expect(mockCommandBus.execute).toHaveBeenCalled();

      await controller.deactivate(customerId);
      expect(mockCommandBus.execute).toHaveBeenCalled();
    });
  });

  describe('GetAdminCustomerDetailsHandler', () => {
    it('throws NOT_FOUND when customer does not exist', async () => {
      const mockDb = {
        select: vi.fn().mockReturnThis(),
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([]),
      } as any;

      const handler = new GetAdminCustomerDetailsHandler(mockDb);
      await expect(
        handler.execute(new GetAdminCustomerDetailsQuery('non-existent-id')),
      ).rejects.toThrow(/not found/i);
    });
  });
});
