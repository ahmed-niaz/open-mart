import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';

import { AnalyticsController } from './presentation/analytics.controller.js';

import { GetAnalyticsSummaryHandler } from './application/queries/get-analytics-summary/get-analytics-summary.handler.js';
import { GetSalesChartHandler } from './application/queries/get-sales-chart/get-sales-chart.handler.js';
import { GetOrderStatusStatsHandler } from './application/queries/get-order-status-stats/get-order-status-stats.handler.js';
import { GetTopProductsHandler } from './application/queries/get-top-products/get-top-products.handler.js';
import { GetInventoryHealthHandler } from './application/queries/get-inventory-health/get-inventory-health.handler.js';
import { GetCustomerInsightsHandler } from './application/queries/get-customer-insights/get-customer-insights.handler.js';
import { GetRecentActivityHandler } from './application/queries/get-recent-activity/get-recent-activity.handler.js';

const QueryHandlers = [
  GetAnalyticsSummaryHandler,
  GetSalesChartHandler,
  GetOrderStatusStatsHandler,
  GetTopProductsHandler,
  GetInventoryHealthHandler,
  GetCustomerInsightsHandler,
  GetRecentActivityHandler,
];

@Module({
  imports: [CqrsModule],
  controllers: [AnalyticsController],
  providers: [...QueryHandlers],
  exports: [...QueryHandlers],
})
export class AnalyticsModule {}
