import { describe, expect, it, vi } from 'vitest';
import { Reflector } from '@nestjs/core';

import { AnalyticsController } from '../../src/analytics/presentation/analytics.controller.js';
import { AdminPermission } from '../../src/shared/infrastructure/guards/admin-permissions.js';
import { PERMISSIONS_KEY } from '../../src/shared/presentation/decorators/require-permissions.decorator.js';

describe('AnalyticsController Unit Tests', () => {
  const reflector = new Reflector();

  it('declares strict permissions on every analytical route', () => {
    const summaryPerms = reflector.get<AdminPermission[]>(
      PERMISSIONS_KEY,
      AnalyticsController.prototype.getSummary,
    );
    expect(summaryPerms).toEqual([AdminPermission.ANALYTICS_READ]);

    const salesChartPerms = reflector.get<AdminPermission[]>(
      PERMISSIONS_KEY,
      AnalyticsController.prototype.getSalesChart,
    );
    expect(salesChartPerms).toEqual([AdminPermission.ANALYTICS_FINANCIAL_READ]);

    const orderStatusPerms = reflector.get<AdminPermission[]>(
      PERMISSIONS_KEY,
      AnalyticsController.prototype.getOrderStatus,
    );
    expect(orderStatusPerms).toEqual([AdminPermission.ANALYTICS_READ]);

    const topProductsPerms = reflector.get<AdminPermission[]>(
      PERMISSIONS_KEY,
      AnalyticsController.prototype.getTopProducts,
    );
    expect(topProductsPerms).toEqual([AdminPermission.ANALYTICS_READ]);

    const inventoryHealthPerms = reflector.get<AdminPermission[]>(
      PERMISSIONS_KEY,
      AnalyticsController.prototype.getInventoryHealth,
    );
    expect(inventoryHealthPerms).toEqual([AdminPermission.ANALYTICS_READ]);

    const customerInsightsPerms = reflector.get<AdminPermission[]>(
      PERMISSIONS_KEY,
      AnalyticsController.prototype.getCustomerInsights,
    );
    expect(customerInsightsPerms).toEqual([AdminPermission.ANALYTICS_READ]);

    const recentActivityPerms = reflector.get<AdminPermission[]>(
      PERMISSIONS_KEY,
      AnalyticsController.prototype.getRecentActivity,
    );
    expect(recentActivityPerms).toEqual([AdminPermission.ANALYTICS_READ]);
  });

  it('delegates to QueryBus with proper permission flags', async () => {
    const mockQueryBus = {
      execute: vi.fn().mockResolvedValue({ success: true }),
    };

    const controller = new AnalyticsController(mockQueryBus as any);

    // Call as support user
    await controller.getSummary(
      { period: '30d' },
      { id: 'usr-1', email: 'support@store.com', role: 'support' },
    );

    expect(mockQueryBus.execute).toHaveBeenCalledWith(
      expect.objectContaining({
        period: '30d',
        hasFinancialPermission: false,
      }),
    );

    // Call as super-admin user
    await controller.getSummary(
      { period: '30d' },
      { id: 'usr-2', email: 'admin@store.com', role: 'super-admin' },
    );

    expect(mockQueryBus.execute).toHaveBeenCalledWith(
      expect.objectContaining({
        period: '30d',
        hasFinancialPermission: true,
      }),
    );
  });
});
