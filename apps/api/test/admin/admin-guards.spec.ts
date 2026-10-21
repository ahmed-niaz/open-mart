import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import { AdminJwtGuard } from '../../src/shared/infrastructure/guards/admin-jwt.guard.js';
import { PermissionsGuard } from '../../src/shared/infrastructure/guards/permissions.guard.js';
import { AdminPermission } from '../../src/shared/infrastructure/guards/admin-permissions.js';
import { PERMISSIONS_KEY } from '../../src/shared/presentation/decorators/require-permissions.decorator.js';
import { ALLOW_PENDING_PASSWORD_CHANGE_KEY } from '../../src/shared/presentation/decorators/allow-pending-password-change.decorator.js';

describe('Admin Guards Unit Tests', () => {
  describe('AdminJwtGuard', () => {
    let mockTokenService: any;
    let mockDb: any;
    let guard: AdminJwtGuard;

    beforeEach(() => {
      mockTokenService = {
        verifyAccessToken: vi.fn(),
      };
      mockDb = {
        select: vi.fn(),
      };
      guard = new AdminJwtGuard(mockTokenService, mockDb);
    });

    const createMockContext = (
      authHeader?: string,
      user?: any,
    ): ExecutionContext => {
      const request: any = {
        headers: authHeader ? { authorization: authHeader } : {},
        user,
      };
      return {
        switchToHttp: () => ({
          getRequest: () => request,
        }),
      } as unknown as ExecutionContext;
    };

    it('allows access for a valid active admin token', async () => {
      mockTokenService.verifyAccessToken.mockResolvedValue({
        sub: 'admin-uuid-1',
        email: 'admin@openmart.com',
        scope: 'admin',
        role: 'admin',
      });

      // DB query returns active admin
      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([
              {
                id: 'admin-uuid-1',
                role: 'admin',
                isActive: true,
                mustChangePassword: false,
              },
            ]),
          }),
        }),
      });

      const ctx = createMockContext('Bearer valid_admin_token');
      const result = await guard.canActivate(ctx);

      expect(result).toBe(true);
      const req = ctx.switchToHttp().getRequest<any>();
      expect(req.user.scope).toBe('admin');
      expect(req.user.role).toBe('admin');
    });

    it('rejects tokens with customer scope (Forbidden)', async () => {
      mockTokenService.verifyAccessToken.mockResolvedValue({
        sub: 'customer-uuid-1',
        email: 'customer@example.com',
        scope: 'customer',
      });

      const ctx = createMockContext('Bearer customer_token');
      await expect(guard.canActivate(ctx)).rejects.toThrow(
        /Token scope 'customer' is not authorized/,
      );
    });

    it('rejects an existing token if the admin account has been deactivated', async () => {
      mockTokenService.verifyAccessToken.mockResolvedValue({
        sub: 'admin-uuid-fired',
        email: 'fired@openmart.com',
        scope: 'admin',
        role: 'support',
      });

      // DB query returns deactivated admin
      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([
              {
                id: 'admin-uuid-fired',
                role: 'support',
                isActive: false, // DEACTIVATED
                mustChangePassword: false,
              },
            ]),
          }),
        }),
      });

      const ctx = createMockContext('Bearer stale_admin_token');
      await expect(guard.canActivate(ctx)).rejects.toThrow(
        /Account is deactivated or does not exist/,
      );
    });
  });

  describe('PermissionsGuard', () => {
    let reflector: Reflector;
    let guard: PermissionsGuard;

    beforeEach(() => {
      reflector = new Reflector();
      guard = new PermissionsGuard(reflector);
    });

    const createMockContext = (user?: any): ExecutionContext => {
      return {
        switchToHttp: () => ({
          getRequest: () => ({ user }),
        }),
        getHandler: () => ({}),
        getClass: () => ({}),
      } as unknown as ExecutionContext;
    };

    it('denies by default when a route has no permissions metadata declared', () => {
      vi.spyOn(reflector, 'getAllAndOverride').mockImplementation((key) => {
        if (key === PERMISSIONS_KEY) return undefined;
        return undefined;
      });

      const ctx = createMockContext({
        id: 'admin-1',
        scope: 'admin',
        role: 'super-admin',
      });

      expect(() => guard.canActivate(ctx)).toThrow(
        /Forbidden: Access denied. Explicit permissions required/,
      );
    });

    it('allows super-admin access for any required permission', () => {
      vi.spyOn(reflector, 'getAllAndOverride').mockImplementation((key) => {
        if (key === PERMISSIONS_KEY) return [AdminPermission.SYSTEM_SETTINGS];
        return undefined;
      });

      const ctx = createMockContext({
        id: 'super-1',
        scope: 'admin',
        role: 'super-admin',
      });

      expect(guard.canActivate(ctx)).toBe(true);
    });

    it('allows manager to restock inventory', () => {
      vi.spyOn(reflector, 'getAllAndOverride').mockImplementation((key) => {
        if (key === PERMISSIONS_KEY) return [AdminPermission.INVENTORY_RESTOCK];
        return undefined;
      });

      const ctx = createMockContext({
        id: 'mgr-1',
        scope: 'admin',
        role: 'manager',
      });

      expect(guard.canActivate(ctx)).toBe(true);
    });

    it('denies support staff from restocking inventory (Insufficient permissions)', () => {
      vi.spyOn(reflector, 'getAllAndOverride').mockImplementation((key) => {
        if (key === PERMISSIONS_KEY) return [AdminPermission.INVENTORY_RESTOCK];
        return undefined;
      });

      const ctx = createMockContext({
        id: 'supp-1',
        scope: 'admin',
        role: 'support',
      });

      expect(() => guard.canActivate(ctx)).toThrow(
        /Forbidden: Insufficient permissions for this operation/,
      );
    });

    it('blocks user when mustChangePassword is true on general routes', () => {
      vi.spyOn(reflector, 'getAllAndOverride').mockImplementation((key) => {
        if (key === PERMISSIONS_KEY) return [AdminPermission.ORDERS_READ];
        if (key === ALLOW_PENDING_PASSWORD_CHANGE_KEY) return false;
        return undefined;
      });

      const ctx = createMockContext({
        id: 'staff-1',
        scope: 'admin',
        role: 'admin',
        mustChangePassword: true,
      });

      expect(() => guard.canActivate(ctx)).toThrow(
        /Password change required before accessing other resources/,
      );
    });

    it('allows user with mustChangePassword = true to access route marked with AllowPendingPasswordChange', () => {
      vi.spyOn(reflector, 'getAllAndOverride').mockImplementation((key) => {
        if (key === PERMISSIONS_KEY) return [AdminPermission.STAFF_READ];
        if (key === ALLOW_PENDING_PASSWORD_CHANGE_KEY) return true;
        return undefined;
      });

      const ctx = createMockContext({
        id: 'staff-1',
        scope: 'admin',
        role: 'admin',
        mustChangePassword: true,
      });

      expect(guard.canActivate(ctx)).toBe(true);
    });
  });
});
