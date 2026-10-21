import { beforeAll, afterAll, describe, expect, it } from 'vitest';
import { sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as dotenv from 'dotenv';
import { resolve } from 'node:path';

import { GetAnalyticsSummaryHandler } from '../../src/analytics/application/queries/get-analytics-summary/get-analytics-summary.handler.js';
import { GetAnalyticsSummaryQuery } from '../../src/analytics/application/queries/get-analytics-summary/get-analytics-summary.query.js';
import { GetSalesChartHandler } from '../../src/analytics/application/queries/get-sales-chart/get-sales-chart.handler.js';
import { GetSalesChartQuery } from '../../src/analytics/application/queries/get-sales-chart/get-sales-chart.query.js';
import { GetCustomerInsightsHandler } from '../../src/analytics/application/queries/get-customer-insights/get-customer-insights.handler.js';
import { GetCustomerInsightsQuery } from '../../src/analytics/application/queries/get-customer-insights/get-customer-insights.query.js';
import { GetRecentActivityHandler } from '../../src/analytics/application/queries/get-recent-activity/get-recent-activity.handler.js';
import { GetRecentActivityQuery } from '../../src/analytics/application/queries/get-recent-activity/get-recent-activity.query.js';
import { GetOrderStatusStatsHandler } from '../../src/analytics/application/queries/get-order-status-stats/get-order-status-stats.handler.js';
import { GetOrderStatusStatsQuery } from '../../src/analytics/application/queries/get-order-status-stats/get-order-status-stats.query.js';
import { GetInventoryHealthHandler } from '../../src/analytics/application/queries/get-inventory-health/get-inventory-health.handler.js';
import { GetInventoryHealthQuery } from '../../src/analytics/application/queries/get-inventory-health/get-inventory-health.query.js';

dotenv.config({ path: resolve(process.cwd(), '.env') });
dotenv.config({ path: resolve(process.cwd(), 'apps/api/.env') });

const dbUrl =
  process.env.POSTGRES_DB_URL ||
  'postgresql://postgres:postgres@localhost:5432/openmart';

describe('Analytics Real Database Integration Tests', () => {
  let client: postgres.Sql;
  let db: any;
  let mockConfigService: any;

  beforeAll(async () => {
    client = postgres(dbUrl, { max: 1 });
    db = drizzle(client);

    mockConfigService = {
      get: (key: string) => {
        if (key === 'STORE_TIMEZONE') return 'Asia/Dhaka';
        return null;
      },
    };
  });

  afterAll(async () => {
    if (client) {
      await client.end();
    }
  });

  it('proves Asia/Dhaka (UTC+6) timezone boundary grouping in PostgreSQL', async () => {
    // 2026-10-20 23:30 Dhaka time is 2026-10-20 17:30 UTC
    // 2026-10-21 00:30 Dhaka time is 2026-10-20 18:30 UTC (SAME UTC DAY!)
    const utcDate1 = '2026-10-20T17:30:00.000Z';
    const utcDate2 = '2026-10-20T18:30:00.000Z';

    const result = await db.execute(sql`
      SELECT 
        DATE_TRUNC('day', (${utcDate1}::timestamptz AT TIME ZONE 'Asia/Dhaka'))::text AS day1_dhaka,
        DATE_TRUNC('day', (${utcDate2}::timestamptz AT TIME ZONE 'Asia/Dhaka'))::text AS day2_dhaka,
        DATE_TRUNC('day', ${utcDate1}::timestamptz)::text AS day1_utc,
        DATE_TRUNC('day', ${utcDate2}::timestamptz)::text AS day2_utc
    `);

    const row = (result as any[])[0];

    // In UTC, both dates belong to 2026-10-20
    expect(row.day1_utc.slice(0, 10)).toBe('2026-10-20');
    expect(row.day2_utc.slice(0, 10)).toBe('2026-10-20');

    // In Asia/Dhaka, they strictly cross the midnight boundary into two separate calendar days!
    expect(row.day1_dhaka.slice(0, 10)).toBe('2026-10-20');
    expect(row.day2_dhaka.slice(0, 10)).toBe('2026-10-21');
  });

  it('GetAnalyticsSummaryHandler executes successfully and applies financial field redaction for non-financial callers', async () => {
    const handler = new GetAnalyticsSummaryHandler(db, mockConfigService);

    // Call as privileged admin (financial permission = true)
    const adminSummary = await handler.execute(
      new GetAnalyticsSummaryQuery('30d', undefined, undefined, true),
    );

    expect(adminSummary.currency).toBe('BDT');
    expect(adminSummary.currencyUnit).toBe('poisha');
    expect(adminSummary.operationalAlerts).toBeDefined();
    expect(typeof adminSummary.currentPeriod.totalOrders).toBe('number');

    // Call as support user (financial permission = false)
    const supportSummary = await handler.execute(
      new GetAnalyticsSummaryQuery('30d', undefined, undefined, false),
    );

    // Operational numbers remain intact for support
    expect(typeof supportSummary.currentPeriod.totalOrders).toBe('number');
    expect(typeof supportSummary.currentPeriod.totalUnitsSold).toBe('number');
    expect(typeof supportSummary.currentPeriod.newCustomers).toBe('number');
    expect(supportSummary.operationalAlerts).toBeDefined();

    // Financial revenue fields are strictly REDACTED (null)
    expect(supportSummary.currentPeriod.grossRevenue).toBeNull();
    expect(supportSummary.currentPeriod.netRevenue).toBeNull();
    expect(supportSummary.currentPeriod.averageOrderValue).toBeNull();
    expect(supportSummary.previousPeriod.grossRevenue).toBeNull();
    expect(supportSummary.previousPeriod.netRevenue).toBeNull();
    expect(supportSummary.previousPeriod.averageOrderValue).toBeNull();
    expect(supportSummary.delta.revenuePercentage).toBeNull();
    expect(supportSummary.delta.aovPercentage).toBeNull();
  });

  it('GetSalesChartHandler generates continuous timeline with zero-fill via generate_series', async () => {
    const handler = new GetSalesChartHandler(db, mockConfigService);

    const result = await handler.execute(new GetSalesChartQuery('7d', 'day'));

    expect(result.currency).toBe('BDT');
    expect(result.currencyUnit).toBe('poisha');
    expect(result.interval).toBe('day');
    expect(result.timezone).toBe('Asia/Dhaka');
    expect(Array.isArray(result.series)).toBe(true);

    // Series must have entries for every day
    expect(result.series.length).toBeGreaterThanOrEqual(7);
    for (const point of result.series) {
      expect(typeof point.grossRevenue).toBe('number');
      expect(typeof point.netRevenue).toBe('number');
      expect(typeof point.orderCount).toBe('number');
      expect(typeof point.unitsSold).toBe('number');
      expect(point.netRevenue).toBeLessThanOrEqual(point.grossRevenue);
    }
  });

  it('GetOrderStatusStatsHandler returns all statuses derived dynamically with mature cohort metrics', async () => {
    const handler = new GetOrderStatusStatsHandler(db, mockConfigService);

    const result = await handler.execute(new GetOrderStatusStatsQuery('30d'));

    expect(result.statuses).toBeDefined();
    // Must contain all 7 valid order statuses
    const statusNames = result.statuses.map((s) => s.status);
    expect(statusNames).toContain('pending');
    expect(statusNames).toContain('confirmed');
    expect(statusNames).toContain('processing');
    expect(statusNames).toContain('shipped');
    expect(statusNames).toContain('delivered');
    expect(statusNames).toContain('cancelled');
    expect(statusNames).toContain('returned');

    expect(typeof result.kpis.totalOrders).toBe('number');
    expect(typeof result.kpis.cancellationRate).toBe('number');
    expect(typeof result.kpis.returnRate).toBe('number');
  });

  it('GetInventoryHealthHandler returns inventory summary and low-stock urgency alerts', async () => {
    const handler = new GetInventoryHealthHandler(db);

    const result = await handler.execute(new GetInventoryHealthQuery(10));

    expect(result.currency).toBe('BDT');
    expect(typeof result.summary.totalSkus).toBe('number');
    expect(typeof result.summary.inStockSkus).toBe('number');
    expect(typeof result.summary.lowStockSkus).toBe('number');
    expect(typeof result.summary.outOfStockSkus).toBe('number');
    expect(typeof result.summary.estimatedRetailValue).toBe('number');
    expect(Array.isArray(result.lowStockAlerts)).toBe(true);
  });

  it('GetCustomerInsightsHandler masks PII when caller lacks customers:read_pii permission', async () => {
    const handler = new GetCustomerInsightsHandler(db, mockConfigService);

    // Without PII permission
    const maskedResult = await handler.execute(
      new GetCustomerInsightsQuery('30d', 5, undefined, undefined, false),
    );

    for (const customer of maskedResult.topCustomers) {
      if (customer.email) {
        expect(customer.email).toContain('***');
      }
    }

    // Geographic divisions array present
    expect(Array.isArray(maskedResult.geographicBreakdown)).toBe(true);
    expect(typeof maskedResult.summary.totalRegisteredCustomers).toBe('number');
  });

  it('GetRecentActivityHandler filters payment and audit events based on caller permissions', async () => {
    const handler = new GetRecentActivityHandler(db);

    // Support caller: no financial permission, no audit permission
    const supportFeed = await handler.execute(
      new GetRecentActivityQuery(10, undefined, false, false),
    );

    // Must NOT contain payment or admin_audit events
    for (const item of supportFeed.items) {
      expect(item.type).toBe('order');
    }

    // Super-admin caller: full permissions
    const adminFeed = await handler.execute(
      new GetRecentActivityQuery(10, undefined, true, true),
    );

    expect(Array.isArray(adminFeed.items)).toBe(true);
  });
});
