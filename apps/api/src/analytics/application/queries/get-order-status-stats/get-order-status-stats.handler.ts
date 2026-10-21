import { Inject } from '@nestjs/common';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { and, gte, lte, sql } from 'drizzle-orm';
import { ConfigService } from '@nestjs/config';

import { GetOrderStatusStatsQuery } from './get-order-status-stats.query.js';
import type {
  OrderStatusBreakdownItem,
  OrderStatusStatsResult,
} from './get-order-status-stats.result.js';
import {
  DRIZZLE,
  type DrizzleDB,
} from '../../../../shared/infrastructure/database/postgres/drizzle.provider.js';
import {
  ORDER_STATUSES,
  ordersSchema,
  orderStatusHistorySchema,
  type OrderStatusValue,
} from '../../../../shared/infrastructure/database/postgres/schema/order.schema.js';
import {
  DEFAULT_STORE_TIMEZONE,
  resolveDateRange,
} from '../../../infrastructure/utils/analytics-date.helper.js';

@QueryHandler(GetOrderStatusStatsQuery)
export class GetOrderStatusStatsHandler implements IQueryHandler<
  GetOrderStatusStatsQuery,
  OrderStatusStatsResult
> {
  constructor(
    @Inject(DRIZZLE) private readonly db: DrizzleDB,
    private readonly configService: ConfigService,
  ) {}

  async execute(
    query: GetOrderStatusStatsQuery,
  ): Promise<OrderStatusStatsResult> {
    const timezone =
      this.configService.get<string>('STORE_TIMEZONE') ||
      DEFAULT_STORE_TIMEZONE;

    const range = resolveDateRange(
      query.period,
      query.startDate,
      query.endDate,
      timezone,
    );

    // Three days ago threshold for mature cohort rate
    const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);

    const [statusCounts, matureCounts, historyTransitions] = await Promise.all([
      // 1. Current status breakdown for orders placed in range
      this.db
        .select({
          status: ordersSchema.status,
          count: sql<number>`COUNT(${ordersSchema.id})::int`,
          totalAmount: sql<string>`COALESCE(SUM(${ordersSchema.totalAmount}), 0)::text`,
        })
        .from(ordersSchema)
        .where(
          and(
            gte(ordersSchema.createdAt, range.current.start),
            lte(ordersSchema.createdAt, range.current.end),
          ),
        )
        .groupBy(ordersSchema.status),

      // 2. Mature cohort (orders placed >= 3 days ago)
      this.db
        .select({
          totalMature: sql<number>`COUNT(${ordersSchema.id})::int`,
          deliveredMature: sql<number>`COALESCE(SUM(CASE WHEN ${ordersSchema.status} = 'delivered' THEN 1 ELSE 0 END), 0)::int`,
          cancelledMature: sql<number>`COALESCE(SUM(CASE WHEN ${ordersSchema.status} = 'cancelled' THEN 1 ELSE 0 END), 0)::int`,
        })
        .from(ordersSchema)
        .where(
          and(
            gte(ordersSchema.createdAt, range.current.start),
            lte(
              ordersSchema.createdAt,
              range.current.end < threeDaysAgo
                ? range.current.end
                : threeDaysAgo,
            ),
          ),
        ),

      // 3. Historical status transitions from order_status_history in range
      this.db
        .select({
          toStatus: orderStatusHistorySchema.toStatus,
          count: sql<number>`COUNT(DISTINCT ${orderStatusHistorySchema.orderId})::int`,
        })
        .from(orderStatusHistorySchema)
        .where(
          and(
            gte(orderStatusHistorySchema.changedAt, range.current.start),
            lte(orderStatusHistorySchema.changedAt, range.current.end),
          ),
        )
        .groupBy(orderStatusHistorySchema.toStatus),
    ]);

    const countsMap = new Map<
      OrderStatusValue,
      { count: number; totalAmount: number }
    >();
    let totalOrders = 0;

    for (const row of statusCounts) {
      const cnt = Number(row.count ?? 0);
      const amt = Number(row.totalAmount ?? 0);
      countsMap.set(row.status as OrderStatusValue, {
        count: cnt,
        totalAmount: amt,
      });
      totalOrders += cnt;
    }

    const statuses: OrderStatusBreakdownItem[] = ORDER_STATUSES.map((st) => {
      const data = countsMap.get(st) || { count: 0, totalAmount: 0 };
      const pct =
        totalOrders > 0
          ? Math.round((data.count / totalOrders) * 1000) / 10
          : 0;

      return {
        status: st,
        count: data.count,
        totalAmount: data.totalAmount,
        percentage: pct,
      };
    });

    // Mature cohort fulfillment rate calculation
    const matureRow = matureCounts[0];
    const totalMature = Number(matureRow?.totalMature ?? 0);
    const deliveredMature = Number(matureRow?.deliveredMature ?? 0);
    const cancelledMature = Number(matureRow?.cancelledMature ?? 0);
    const matureDenominator = totalMature - cancelledMature;

    const matureCohortFulfillmentRate =
      matureDenominator > 0
        ? Math.round((deliveredMature / matureDenominator) * 1000) / 10
        : null;

    // Current cancellations and returns
    const cancelledCount = countsMap.get('cancelled')?.count ?? 0;
    const deliveredCount = countsMap.get('delivered')?.count ?? 0;
    const returnedCount = countsMap.get('returned')?.count ?? 0;

    const cancellationRate =
      totalOrders > 0
        ? Math.round((cancelledCount / totalOrders) * 1000) / 10
        : 0;

    // returnRate = returned / (delivered + returned) * 100
    const returnDenominator = deliveredCount + returnedCount;
    const returnRate =
      returnDenominator > 0
        ? Math.round((returnedCount / returnDenominator) * 1000) / 10
        : 0;

    // Transitions from history
    let cancelledInPeriodCount = 0;
    let returnedInPeriodCount = 0;
    for (const h of historyTransitions) {
      if (h.toStatus === 'cancelled') {
        cancelledInPeriodCount = Number(h.count ?? 0);
      } else if (h.toStatus === 'returned') {
        returnedInPeriodCount = Number(h.count ?? 0);
      }
    }

    return {
      period: {
        selected: range.period,
        from: range.current.start.toISOString(),
        to: range.current.end.toISOString(),
      },
      statuses,
      kpis: {
        totalOrders,
        matureCohortFulfillmentRate,
        cancellationRate,
        returnRate,
        cancelledInPeriodCount,
        returnedInPeriodCount,
      },
    };
  }
}
