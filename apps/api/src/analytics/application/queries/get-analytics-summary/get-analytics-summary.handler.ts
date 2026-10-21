import { Inject } from '@nestjs/common';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { and, eq, gte, inArray, lte, ne, sql } from 'drizzle-orm';
import { ConfigService } from '@nestjs/config';

import { GetAnalyticsSummaryQuery } from './get-analytics-summary.query.js';
import type {
  AnalyticsSummaryResult,
  PeriodFinancialMetrics,
} from './get-analytics-summary.result.js';
import {
  DRIZZLE,
  type DrizzleDB,
} from '../../../../shared/infrastructure/database/postgres/drizzle.provider.js';
import { ordersSchema } from '../../../../shared/infrastructure/database/postgres/schema/order.schema.js';
import { orderItemsSchema } from '../../../../shared/infrastructure/database/postgres/schema/order.schema.js';
import { paymentsSchema } from '../../../../shared/infrastructure/database/postgres/schema/payment.schema.js';
import { customersSchema } from '../../../../shared/infrastructure/database/postgres/schema/customer.schema.js';
import { inventoryItemsSchema } from '../../../../shared/infrastructure/database/postgres/schema/inventory.schema.js';
import {
  calculatePercentageDelta,
  DEFAULT_STORE_TIMEZONE,
  resolveDateRange,
} from '../../../infrastructure/utils/analytics-date.helper.js';

interface CacheEntry {
  data: AnalyticsSummaryResult;
  expiresAt: number;
}

@QueryHandler(GetAnalyticsSummaryQuery)
export class GetAnalyticsSummaryHandler implements IQueryHandler<
  GetAnalyticsSummaryQuery,
  AnalyticsSummaryResult
> {
  private readonly cache = new Map<string, CacheEntry>();
  private readonly cacheTtlMs = 30_000; // 30 seconds

  constructor(
    @Inject(DRIZZLE) private readonly db: DrizzleDB,
    private readonly configService: ConfigService,
  ) {}

  async execute(
    query: GetAnalyticsSummaryQuery,
  ): Promise<AnalyticsSummaryResult> {
    const timezone =
      this.configService.get<string>('STORE_TIMEZONE') ||
      DEFAULT_STORE_TIMEZONE;

    const range = resolveDateRange(
      query.period,
      query.startDate,
      query.endDate,
      timezone,
    );

    const cacheKey = `${range.period}:${range.current.start.toISOString()}:${range.current.end.toISOString()}:${query.hasFinancialPermission}`;
    const cached = this.cache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.data;
    }

    // Run current window, comparison window, and real-time operational alerts in parallel
    const [
      currentPayments,
      currentOrders,
      currentCustomers,
      prevPayments,
      prevOrders,
      prevCustomers,
      pendingOrders,
      processingOrders,
      lowStock,
      outOfStock,
      paymentReview,
    ] = await Promise.all([
      // 1. Current Window Payments (Cash inflow)
      this.db
        .select({
          grossRevenue: sql<string>`COALESCE(SUM(${paymentsSchema.amount}), 0)::text`,
          refunds: sql<string>`COALESCE(SUM(${paymentsSchema.refundedAmount}), 0)::text`,
        })
        .from(paymentsSchema)
        .where(
          and(
            eq(paymentsSchema.status, 'completed'),
            gte(paymentsSchema.paidAt, range.current.start),
            lte(paymentsSchema.paidAt, range.current.end),
          ),
        ),

      // 2. Current Window Orders & Items
      this.db
        .select({
          totalOrders: sql<number>`COUNT(DISTINCT ${ordersSchema.id})::int`,
          totalUnitsSold: sql<number>`COALESCE(SUM(${orderItemsSchema.quantity}), 0)::int`,
        })
        .from(ordersSchema)
        .leftJoin(
          orderItemsSchema,
          eq(orderItemsSchema.orderId, ordersSchema.id),
        )
        .where(
          and(
            gte(ordersSchema.createdAt, range.current.start),
            lte(ordersSchema.createdAt, range.current.end),
            ne(ordersSchema.status, 'cancelled'),
          ),
        ),

      // 3. Current Window Customers
      this.db
        .select({
          newCustomers: sql<number>`COUNT(${customersSchema.id})::int`,
        })
        .from(customersSchema)
        .where(
          and(
            gte(customersSchema.createdAt, range.current.start),
            lte(customersSchema.createdAt, range.current.end),
          ),
        ),

      // 4. Previous Window Payments
      this.db
        .select({
          grossRevenue: sql<string>`COALESCE(SUM(${paymentsSchema.amount}), 0)::text`,
          refunds: sql<string>`COALESCE(SUM(${paymentsSchema.refundedAmount}), 0)::text`,
        })
        .from(paymentsSchema)
        .where(
          and(
            eq(paymentsSchema.status, 'completed'),
            gte(paymentsSchema.paidAt, range.comparison.start),
            lte(paymentsSchema.paidAt, range.comparison.end),
          ),
        ),

      // 5. Previous Window Orders & Items
      this.db
        .select({
          totalOrders: sql<number>`COUNT(DISTINCT ${ordersSchema.id})::int`,
          totalUnitsSold: sql<number>`COALESCE(SUM(${orderItemsSchema.quantity}), 0)::int`,
        })
        .from(ordersSchema)
        .leftJoin(
          orderItemsSchema,
          eq(orderItemsSchema.orderId, ordersSchema.id),
        )
        .where(
          and(
            gte(ordersSchema.createdAt, range.comparison.start),
            lte(ordersSchema.createdAt, range.comparison.end),
            ne(ordersSchema.status, 'cancelled'),
          ),
        ),

      // 6. Previous Window Customers
      this.db
        .select({
          newCustomers: sql<number>`COUNT(${customersSchema.id})::int`,
        })
        .from(customersSchema)
        .where(
          and(
            gte(customersSchema.createdAt, range.comparison.start),
            lte(customersSchema.createdAt, range.comparison.end),
          ),
        ),

      // 7. Operational Alert: Pending orders awaiting fulfillment
      this.db
        .select({ count: sql<number>`COUNT(${ordersSchema.id})::int` })
        .from(ordersSchema)
        .where(inArray(ordersSchema.status, ['pending', 'confirmed'])),

      // 8. Operational Alert: Processing / shipped orders
      this.db
        .select({ count: sql<number>`COUNT(${ordersSchema.id})::int` })
        .from(ordersSchema)
        .where(inArray(ordersSchema.status, ['processing', 'shipped'])),

      // 9. Operational Alert: Low Stock items
      this.db
        .select({ count: sql<number>`COUNT(${inventoryItemsSchema.id})::int` })
        .from(inventoryItemsSchema)
        .where(
          and(
            eq(inventoryItemsSchema.isActive, true),
            lte(
              inventoryItemsSchema.quantityOnHand,
              inventoryItemsSchema.lowStockThreshold,
            ),
            sql`${inventoryItemsSchema.quantityOnHand} > 0`,
          ),
        ),

      // 10. Operational Alert: Out of Stock items
      this.db
        .select({ count: sql<number>`COUNT(${inventoryItemsSchema.id})::int` })
        .from(inventoryItemsSchema)
        .where(
          and(
            eq(inventoryItemsSchema.isActive, true),
            lte(inventoryItemsSchema.quantityOnHand, 0),
          ),
        ),

      // 11. Operational Alert: Payment Reviews / Failures
      this.db
        .select({ count: sql<number>`COUNT(${paymentsSchema.id})::int` })
        .from(paymentsSchema)
        .where(inArray(paymentsSchema.status, ['needs_review', 'failed'])),
    ]);

    // Parse financial values
    const currGross = Number(currentPayments[0]?.grossRevenue ?? 0);
    const currRefunds = Number(currentPayments[0]?.refunds ?? 0);
    const currNet = Math.max(0, currGross - currRefunds);
    const currOrders = Number(currentOrders[0]?.totalOrders ?? 0);
    const currUnits = Number(currentOrders[0]?.totalUnitsSold ?? 0);
    const currCust = Number(currentCustomers[0]?.newCustomers ?? 0);
    const currAov = currOrders > 0 ? Math.round(currGross / currOrders) : null;

    const prevGross = Number(prevPayments[0]?.grossRevenue ?? 0);
    const prevRefunds = Number(prevPayments[0]?.refunds ?? 0);
    const prevNet = Math.max(0, prevGross - prevRefunds);
    const prevOrdersCount = Number(prevOrders[0]?.totalOrders ?? 0);
    const prevUnits = Number(prevOrders[0]?.totalUnitsSold ?? 0);
    const prevCust = Number(prevCustomers[0]?.newCustomers ?? 0);
    const prevAov =
      prevOrdersCount > 0 ? Math.round(prevGross / prevOrdersCount) : null;

    // Delta calculations (null if previous is 0, so UI renders 'n/a')
    const revenuePercentage = calculatePercentageDelta(currNet, prevNet);
    const ordersPercentage = calculatePercentageDelta(
      currOrders,
      prevOrdersCount,
    );
    const aovPercentage = calculatePercentageDelta(currAov, prevAov);
    const customersPercentage = calculatePercentageDelta(currCust, prevCust);

    // Build metric response with dynamic redaction if financial permission is missing
    const currentPeriodMetrics: PeriodFinancialMetrics = {
      grossRevenue: query.hasFinancialPermission ? currGross : null,
      netRevenue: query.hasFinancialPermission ? currNet : null,
      totalOrders: currOrders,
      averageOrderValue: query.hasFinancialPermission ? currAov : null,
      totalUnitsSold: currUnits,
      newCustomers: currCust,
    };

    const previousPeriodMetrics: PeriodFinancialMetrics = {
      grossRevenue: query.hasFinancialPermission ? prevGross : null,
      netRevenue: query.hasFinancialPermission ? prevNet : null,
      totalOrders: prevOrdersCount,
      averageOrderValue: query.hasFinancialPermission ? prevAov : null,
      totalUnitsSold: prevUnits,
      newCustomers: prevCust,
    };

    const result: AnalyticsSummaryResult = {
      currency: 'BDT',
      currencyUnit: 'poisha',
      period: {
        selected: range.period,
        from: range.current.start.toISOString(),
        to: range.current.end.toISOString(),
        comparisonFrom: range.comparison.start.toISOString(),
        comparisonTo: range.comparison.end.toISOString(),
      },
      currentPeriod: currentPeriodMetrics,
      previousPeriod: previousPeriodMetrics,
      delta: {
        revenuePercentage: query.hasFinancialPermission
          ? revenuePercentage
          : null,
        ordersPercentage,
        aovPercentage: query.hasFinancialPermission ? aovPercentage : null,
        customersPercentage,
      },
      operationalAlerts: {
        pendingOrdersCount: Number(pendingOrders[0]?.count ?? 0),
        processingOrdersCount: Number(processingOrders[0]?.count ?? 0),
        lowStockCount: Number(lowStock[0]?.count ?? 0),
        outOfStockCount: Number(outOfStock[0]?.count ?? 0),
        paymentReviewCount: Number(paymentReview[0]?.count ?? 0),
      },
    };

    this.cache.set(cacheKey, {
      data: result,
      expiresAt: Date.now() + this.cacheTtlMs,
    });

    return result;
  }
}
