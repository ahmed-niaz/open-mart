import {
  Controller,
  Get,
  Query,
  UseGuards,
  ValidationPipe,
} from '@nestjs/common';
import { QueryBus } from '@nestjs/cqrs';

import { AdminJwtGuard } from '../../shared/infrastructure/guards/admin-jwt.guard.js';
import { PermissionsGuard } from '../../shared/infrastructure/guards/permissions.guard.js';
import { RequirePermissions } from '../../shared/presentation/decorators/require-permissions.decorator.js';
import { CurrentAdmin } from '../../shared/presentation/decorators/current-admin.decorator.js';
import type { AuthenticatedUser } from '../../shared/presentation/interfaces/authenticated-user.interface.js';
import {
  AdminPermission,
  ROLE_PERMISSIONS_MAP,
  type AdminRole,
} from '../../shared/infrastructure/guards/admin-permissions.js';

import { AnalyticsDateRangeDto } from './dto/analytics-date-range.dto.js';
import { SalesChartQueryDto } from './dto/sales-chart-query.dto.js';
import { TopProductsQueryDto } from './dto/top-products-query.dto.js';
import { InventoryHealthQueryDto } from './dto/inventory-health-query.dto.js';
import { CustomerInsightsQueryDto } from './dto/customer-insights-query.dto.js';
import { RecentActivityQueryDto } from './dto/recent-activity-query.dto.js';

import { GetAnalyticsSummaryQuery } from '../application/queries/get-analytics-summary/get-analytics-summary.query.js';
import { GetSalesChartQuery } from '../application/queries/get-sales-chart/get-sales-chart.query.js';
import { GetOrderStatusStatsQuery } from '../application/queries/get-order-status-stats/get-order-status-stats.query.js';
import { GetTopProductsQuery } from '../application/queries/get-top-products/get-top-products.query.js';
import { GetInventoryHealthQuery } from '../application/queries/get-inventory-health/get-inventory-health.query.js';
import { GetCustomerInsightsQuery } from '../application/queries/get-customer-insights/get-customer-insights.query.js';
import { GetRecentActivityQuery } from '../application/queries/get-recent-activity/get-recent-activity.query.js';

function hasAdminPermission(
  user: AuthenticatedUser | undefined,
  permission: AdminPermission,
): boolean {
  if (!user || !user.role) {
    return false;
  }
  const perms = ROLE_PERMISSIONS_MAP[user.role as AdminRole];
  return perms ? perms.has(permission) : false;
}

@Controller('admin/analytics')
@UseGuards(AdminJwtGuard, PermissionsGuard)
export class AnalyticsController {
  constructor(private readonly queryBus: QueryBus) {}

  @Get('summary')
  @RequirePermissions(AdminPermission.ANALYTICS_READ)
  async getSummary(
    @Query(new ValidationPipe({ transform: true })) dto: AnalyticsDateRangeDto,
    @CurrentAdmin() admin?: AuthenticatedUser,
  ) {
    const hasFinancialPermission = hasAdminPermission(
      admin,
      AdminPermission.ANALYTICS_FINANCIAL_READ,
    );

    return this.queryBus.execute(
      new GetAnalyticsSummaryQuery(
        dto.period,
        dto.startDate,
        dto.endDate,
        hasFinancialPermission,
      ),
    );
  }

  @Get('sales-chart')
  @RequirePermissions(AdminPermission.ANALYTICS_FINANCIAL_READ)
  async getSalesChart(
    @Query(new ValidationPipe({ transform: true })) dto: SalesChartQueryDto,
  ) {
    return this.queryBus.execute(
      new GetSalesChartQuery(
        dto.period,
        dto.interval,
        dto.startDate,
        dto.endDate,
      ),
    );
  }

  @Get('order-status')
  @RequirePermissions(AdminPermission.ANALYTICS_READ)
  async getOrderStatus(
    @Query(new ValidationPipe({ transform: true })) dto: AnalyticsDateRangeDto,
  ) {
    return this.queryBus.execute(
      new GetOrderStatusStatsQuery(dto.period, dto.startDate, dto.endDate),
    );
  }

  @Get('top-products')
  @RequirePermissions(AdminPermission.ANALYTICS_READ)
  async getTopProducts(
    @Query(new ValidationPipe({ transform: true })) dto: TopProductsQueryDto,
    @CurrentAdmin() admin?: AuthenticatedUser,
  ) {
    const hasFinancialPermission = hasAdminPermission(
      admin,
      AdminPermission.ANALYTICS_FINANCIAL_READ,
    );

    return this.queryBus.execute(
      new GetTopProductsQuery(
        dto.period,
        dto.limit ?? 5,
        dto.sortBy ?? 'revenue',
        dto.startDate,
        dto.endDate,
        hasFinancialPermission,
      ),
    );
  }

  @Get('inventory-health')
  @RequirePermissions(AdminPermission.ANALYTICS_READ)
  async getInventoryHealth(
    @Query(new ValidationPipe({ transform: true }))
    dto: InventoryHealthQueryDto,
  ) {
    return this.queryBus.execute(new GetInventoryHealthQuery(dto.limit ?? 10));
  }

  @Get('customer-insights')
  @RequirePermissions(AdminPermission.ANALYTICS_READ)
  async getCustomerInsights(
    @Query(new ValidationPipe({ transform: true }))
    dto: CustomerInsightsQueryDto,
    @CurrentAdmin() admin?: AuthenticatedUser,
  ) {
    const hasPiiPermission = hasAdminPermission(
      admin,
      AdminPermission.CUSTOMERS_READ_PII,
    );

    return this.queryBus.execute(
      new GetCustomerInsightsQuery(
        dto.period,
        dto.limit ?? 5,
        dto.startDate,
        dto.endDate,
        hasPiiPermission,
      ),
    );
  }

  @Get('recent-activity')
  @RequirePermissions(AdminPermission.ANALYTICS_READ)
  async getRecentActivity(
    @Query(new ValidationPipe({ transform: true })) dto: RecentActivityQueryDto,
    @CurrentAdmin() admin?: AuthenticatedUser,
  ) {
    const hasFinancialPermission = hasAdminPermission(
      admin,
      AdminPermission.ANALYTICS_FINANCIAL_READ,
    );
    const hasAuditPermission = hasAdminPermission(
      admin,
      AdminPermission.AUDIT_READ,
    );

    return this.queryBus.execute(
      new GetRecentActivityQuery(
        dto.limit ?? 10,
        dto.cursor,
        hasFinancialPermission,
        hasAuditPermission,
      ),
    );
  }
}
