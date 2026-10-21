import { Inject } from '@nestjs/common';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { sql } from 'drizzle-orm';
import { ConfigService } from '@nestjs/config';

import { GetSalesChartQuery } from './get-sales-chart.query.js';
import type {
  SalesChartDataPoint,
  SalesChartResult,
} from './get-sales-chart.result.js';
import {
  DRIZZLE,
  type DrizzleDB,
} from '../../../../shared/infrastructure/database/postgres/drizzle.provider.js';
import {
  autoSelectInterval,
  DEFAULT_STORE_TIMEZONE,
  resolveDateRange,
  type ChartInterval,
} from '../../../infrastructure/utils/analytics-date.helper.js';

@QueryHandler(GetSalesChartQuery)
export class GetSalesChartHandler implements IQueryHandler<
  GetSalesChartQuery,
  SalesChartResult
> {
  constructor(
    @Inject(DRIZZLE) private readonly db: DrizzleDB,
    private readonly configService: ConfigService,
  ) {}

  async execute(query: GetSalesChartQuery): Promise<SalesChartResult> {
    const timezone =
      this.configService.get<string>('STORE_TIMEZONE') ||
      DEFAULT_STORE_TIMEZONE;

    const range = resolveDateRange(
      query.period,
      query.startDate,
      query.endDate,
      timezone,
    );

    const interval: ChartInterval = autoSelectInterval(
      range.current.start,
      range.current.end,
      query.interval,
    );

    const stepIntervalMap: Record<ChartInterval, string> = {
      hour: '1 hour',
      day: '1 day',
      week: '1 week',
      month: '1 month',
    };
    const stepInterval = stepIntervalMap[interval];

    // Format SQL query using CTE to prevent Cartesian explosion between payments and order items
    const rows = await this.db.execute<{
      timestamp: string;
      gross_revenue: string;
      refunds: string;
      order_count: number;
      units_sold: number;
    }>(sql`
      WITH time_series AS (
        SELECT series_bucket
        FROM generate_series(
          DATE_TRUNC(${sql.raw(`'${interval}'`)}, (${range.current.start.toISOString()}::timestamptz AT TIME ZONE ${timezone})),
          DATE_TRUNC(${sql.raw(`'${interval}'`)}, (${range.current.end.toISOString()}::timestamptz AT TIME ZONE ${timezone})),
          ${sql.raw(`'${stepInterval}'`)}::interval
        ) AS series_bucket
      ),
      order_buckets AS (
        SELECT 
          DATE_TRUNC(${sql.raw(`'${interval}'`)}, (o.created_at AT TIME ZONE ${timezone})) AS bucket,
          COUNT(DISTINCT o.id)::int AS order_count,
          COALESCE(SUM(oi.quantity), 0)::int AS units_sold
        FROM orders o
        LEFT JOIN order_items oi ON oi.order_id = o.id
        WHERE o.created_at >= ${range.current.start.toISOString()}::timestamptz
          AND o.created_at <= ${range.current.end.toISOString()}::timestamptz
          AND o.status != 'cancelled'
        GROUP BY 1
      ),
      payment_buckets AS (
        SELECT 
          DATE_TRUNC(${sql.raw(`'${interval}'`)}, (p.paid_at AT TIME ZONE ${timezone})) AS bucket,
          COALESCE(SUM(p.amount), 0)::bigint AS gross_revenue,
          COALESCE(SUM(p.refunded_amount), 0)::bigint AS refunds
        FROM payments p
        WHERE p.status = 'completed'
          AND p.paid_at >= ${range.current.start.toISOString()}::timestamptz
          AND p.paid_at <= ${range.current.end.toISOString()}::timestamptz
        GROUP BY 1
      )
      SELECT 
        ts.series_bucket::text AS timestamp,
        COALESCE(pb.gross_revenue, 0)::text AS gross_revenue,
        COALESCE(pb.refunds, 0)::text AS refunds,
        COALESCE(ob.order_count, 0)::int AS order_count,
        COALESCE(ob.units_sold, 0)::int AS units_sold
      FROM time_series ts
      LEFT JOIN order_buckets ob ON ob.bucket = ts.series_bucket
      LEFT JOIN payment_buckets pb ON pb.bucket = ts.series_bucket
      ORDER BY ts.series_bucket ASC;
    `);

    let totalGross = 0;
    let totalNet = 0;
    let totalOrders = 0;
    let totalUnits = 0;

    const series: SalesChartDataPoint[] = (rows as any[]).map((row) => {
      const gross = Number(row.gross_revenue ?? 0);
      const refunds = Number(row.refunds ?? 0);
      const net = Math.max(0, gross - refunds);
      const orders = Number(row.order_count ?? 0);
      const units = Number(row.units_sold ?? 0);

      totalGross += gross;
      totalNet += net;
      totalOrders += orders;
      totalUnits += units;

      const dateObj = new Date(row.timestamp);
      let label: string;
      if (interval === 'hour') {
        label = dateObj.toLocaleTimeString('en-US', {
          hour: '2-digit',
          minute: '2-digit',
          hour12: false,
        });
      } else if (interval === 'day') {
        label = dateObj.toISOString().slice(0, 10);
      } else if (interval === 'week') {
        label = `Wk ${dateObj.toISOString().slice(0, 10)}`;
      } else {
        label = dateObj.toISOString().slice(0, 7);
      }

      return {
        timestamp: row.timestamp,
        label,
        grossRevenue: gross,
        netRevenue: net,
        orderCount: orders,
        unitsSold: units,
      };
    });

    return {
      currency: 'BDT',
      currencyUnit: 'poisha',
      interval,
      timezone,
      series,
      totals: {
        grossRevenue: totalGross,
        netRevenue: totalNet,
        totalOrders,
        totalUnitsSold: totalUnits,
      },
    };
  }
}
