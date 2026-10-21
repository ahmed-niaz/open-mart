import { Inject } from '@nestjs/common';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import {
  and,
  desc,
  eq,
  gte,
  isNotNull,
  isNull,
  lte,
  ne,
  sql,
} from 'drizzle-orm';
import { ConfigService } from '@nestjs/config';

import { GetCustomerInsightsQuery } from './get-customer-insights.query.js';
import type {
  CustomerInsightsResult,
  DivisionBreakdown,
  TopCustomerSpender,
} from './get-customer-insights.result.js';
import {
  DRIZZLE,
  type DrizzleDB,
} from '../../../../shared/infrastructure/database/postgres/drizzle.provider.js';
import { ordersSchema } from '../../../../shared/infrastructure/database/postgres/schema/order.schema.js';
import { customersSchema } from '../../../../shared/infrastructure/database/postgres/schema/customer.schema.js';
import {
  DEFAULT_STORE_TIMEZONE,
  resolveDateRange,
} from '../../../infrastructure/utils/analytics-date.helper.js';
import {
  maskEmail,
  maskName,
} from '../../../infrastructure/utils/pii-masking.helper.js';

@QueryHandler(GetCustomerInsightsQuery)
export class GetCustomerInsightsHandler implements IQueryHandler<
  GetCustomerInsightsQuery,
  CustomerInsightsResult
> {
  constructor(
    @Inject(DRIZZLE) private readonly db: DrizzleDB,
    private readonly configService: ConfigService,
  ) {}

  async execute(
    query: GetCustomerInsightsQuery,
  ): Promise<CustomerInsightsResult> {
    const timezone =
      this.configService.get<string>('STORE_TIMEZONE') ||
      DEFAULT_STORE_TIMEZONE;

    const range = resolveDateRange(
      query.period,
      query.startDate,
      query.endDate,
      timezone,
    );

    const limit = Math.min(50, Math.max(1, query.limit));

    const [
      totalCustRow,
      activeCustRow,
      guestOrdersRow,
      repeatCustRow,
      geoRows,
      topCustomerRows,
    ] = await Promise.all([
      // 1. Total registered active customers
      this.db
        .select({ count: sql<number>`COUNT(${customersSchema.id})::int` })
        .from(customersSchema)
        .where(eq(customersSchema.isActive, true)),

      // 2. Active registered purchasers in period
      this.db
        .select({
          count: sql<number>`COUNT(DISTINCT ${ordersSchema.customerId})::int`,
        })
        .from(ordersSchema)
        .where(
          and(
            isNotNull(ordersSchema.customerId),
            gte(ordersSchema.createdAt, range.current.start),
            lte(ordersSchema.createdAt, range.current.end),
            ne(ordersSchema.status, 'cancelled'),
          ),
        ),

      // 3. Guest checkouts in period (customerId IS NULL)
      this.db
        .select({ count: sql<number>`COUNT(${ordersSchema.id})::int` })
        .from(ordersSchema)
        .where(
          and(
            isNull(ordersSchema.customerId),
            gte(ordersSchema.createdAt, range.current.start),
            lte(ordersSchema.createdAt, range.current.end),
            ne(ordersSchema.status, 'cancelled'),
          ),
        ),

      // 4. Repeat purchasers: ordered in period AND also ordered before range.current.start
      this.db.execute<{ repeat_purchasers: number }>(sql`
        SELECT COUNT(DISTINCT o.customer_id)::int AS repeat_purchasers
        FROM orders o
        WHERE o.customer_id IS NOT NULL
          AND o.created_at >= ${range.current.start.toISOString()}::timestamptz
          AND o.created_at <= ${range.current.end.toISOString()}::timestamptz
          AND o.status != 'cancelled'
          AND EXISTS (
            SELECT 1 FROM orders prior
            WHERE prior.customer_id = o.customer_id
              AND prior.created_at < ${range.current.start.toISOString()}::timestamptz
              AND prior.status != 'cancelled'
          );
      `),

      // 5. Geographic breakdown by division and district
      this.db
        .select({
          division: ordersSchema.shippingDivision,
          district: ordersSchema.shippingDistrict,
          orderCount: sql<number>`COUNT(${ordersSchema.id})::int`,
          totalAmount: sql<string>`COALESCE(SUM(${ordersSchema.totalAmount}), 0)::text`,
        })
        .from(ordersSchema)
        .where(
          and(
            gte(ordersSchema.createdAt, range.current.start),
            lte(ordersSchema.createdAt, range.current.end),
            ne(ordersSchema.status, 'cancelled'),
          ),
        )
        .groupBy(ordersSchema.shippingDivision, ordersSchema.shippingDistrict)
        .orderBy(ordersSchema.shippingDivision),

      // 6. Top customer spenders in period
      this.db
        .select({
          customerId: ordersSchema.customerId,
          firstName: customersSchema.firstName,
          lastName: customersSchema.lastName,
          email: customersSchema.email,
          ordersCount: sql<number>`COUNT(${ordersSchema.id})::int`,
          totalSpent: sql<string>`COALESCE(SUM(${ordersSchema.totalAmount}), 0)::text`,
        })
        .from(ordersSchema)
        .innerJoin(
          customersSchema,
          eq(ordersSchema.customerId, customersSchema.id),
        )
        .where(
          and(
            isNotNull(ordersSchema.customerId),
            gte(ordersSchema.createdAt, range.current.start),
            lte(ordersSchema.createdAt, range.current.end),
            ne(ordersSchema.status, 'cancelled'),
          ),
        )
        .groupBy(
          ordersSchema.customerId,
          customersSchema.firstName,
          customersSchema.lastName,
          customersSchema.email,
        )
        .orderBy(desc(sql`SUM(${ordersSchema.totalAmount})`))
        .limit(limit),
    ]);

    const activePurchasers = Number(activeCustRow[0]?.count ?? 0);
    const repeatPurchasers = Number(
      (repeatCustRow as any[])[0]?.repeat_purchasers ?? 0,
    );
    const repeatRate =
      activePurchasers > 0
        ? Math.round((repeatPurchasers / activePurchasers) * 1000) / 10
        : null;

    // Group geographic rows into divisions with nested districts
    const divisionMap = new Map<
      string,
      {
        orderCount: number;
        totalAmount: number;
        districts: Array<{
          district: string;
          orderCount: number;
          totalAmount: number;
        }>;
      }
    >();

    for (const r of geoRows) {
      const divName = r.division || 'Unknown';
      const distName = r.district || 'Unknown';
      const oCount = Number(r.orderCount ?? 0);
      const amt = Number(r.totalAmount ?? 0);

      let divData = divisionMap.get(divName);
      if (!divData) {
        divData = { orderCount: 0, totalAmount: 0, districts: [] };
        divisionMap.set(divName, divData);
      }

      divData.orderCount += oCount;
      divData.totalAmount += amt;
      divData.districts.push({
        district: distName,
        orderCount: oCount,
        totalAmount: amt,
      });
    }

    const geographicBreakdown: DivisionBreakdown[] = Array.from(
      divisionMap.entries(),
    ).map(([division, val]) => ({
      division,
      orderCount: val.orderCount,
      totalAmount: val.totalAmount,
      districts: val.districts,
    }));

    // Format top customers with optional PII masking
    const topCustomers: TopCustomerSpender[] = topCustomerRows.map((c) => {
      const name = query.hasPiiPermission
        ? `${c.firstName ?? ''} ${c.lastName ?? ''}`.trim() || 'Customer'
        : maskName(c.firstName, c.lastName);

      const email = query.hasPiiPermission ? c.email : maskEmail(c.email);

      return {
        customerId: c.customerId!,
        name,
        email,
        ordersCount: Number(c.ordersCount ?? 0),
        totalSpent: Number(c.totalSpent ?? 0),
      };
    });

    return {
      currency: 'BDT',
      currencyUnit: 'poisha',
      period: {
        selected: range.period,
        from: range.current.start.toISOString(),
        to: range.current.end.toISOString(),
      },
      summary: {
        totalRegisteredCustomers: Number(totalCustRow[0]?.count ?? 0),
        activePurchasersInPeriod: activePurchasers,
        repeatPurchasersInPeriod: repeatPurchasers,
        repeatCustomerRate: repeatRate,
        guestOrdersInPeriod: Number(guestOrdersRow[0]?.count ?? 0),
      },
      geographicBreakdown,
      topCustomers,
    };
  }
}
