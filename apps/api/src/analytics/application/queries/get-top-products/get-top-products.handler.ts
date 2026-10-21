import { Inject } from '@nestjs/common';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { and, desc, eq, gte, lte, ne, sql } from 'drizzle-orm';
import { ConfigService } from '@nestjs/config';

import { GetTopProductsQuery } from './get-top-products.query.js';
import type {
  TopProductItem,
  TopProductsResult,
} from './get-top-products.result.js';
import {
  DRIZZLE,
  type DrizzleDB,
} from '../../../../shared/infrastructure/database/postgres/drizzle.provider.js';
import {
  ordersSchema,
  orderItemsSchema,
} from '../../../../shared/infrastructure/database/postgres/schema/order.schema.js';
import {
  productsSchema,
  type ProductMediaPersistence,
} from '../../../../shared/infrastructure/database/postgres/schema/product.schema.js';
import { inventoryItemsSchema } from '../../../../shared/infrastructure/database/postgres/schema/inventory.schema.js';
import {
  DEFAULT_STORE_TIMEZONE,
  resolveDateRange,
} from '../../../infrastructure/utils/analytics-date.helper.js';

@QueryHandler(GetTopProductsQuery)
export class GetTopProductsHandler implements IQueryHandler<
  GetTopProductsQuery,
  TopProductsResult
> {
  constructor(
    @Inject(DRIZZLE) private readonly db: DrizzleDB,
    private readonly configService: ConfigService,
  ) {}

  async execute(query: GetTopProductsQuery): Promise<TopProductsResult> {
    const timezone =
      this.configService.get<string>('STORE_TIMEZONE') ||
      DEFAULT_STORE_TIMEZONE;

    const range = resolveDateRange(
      query.period,
      query.startDate,
      query.endDate,
      timezone,
    );

    // If caller lacks financial permission, force sorting by units and redact revenue
    const effectiveSortBy = query.hasFinancialPermission
      ? query.sortBy
      : 'units';
    const limit = Math.min(50, Math.max(1, query.limit));

    const revenueExpression = sql<string>`COALESCE(SUM(${orderItemsSchema.quantity} * ${orderItemsSchema.unitPriceAmount}), 0)::text`;
    const unitsExpression = sql<number>`COALESCE(SUM(${orderItemsSchema.quantity}), 0)::int`;

    const orderByClause =
      effectiveSortBy === 'revenue'
        ? desc(
            sql`COALESCE(SUM(${orderItemsSchema.quantity} * ${orderItemsSchema.unitPriceAmount}), 0)`,
          )
        : desc(sql`COALESCE(SUM(${orderItemsSchema.quantity}), 0)`);

    const rows = await this.db
      .select({
        productId: orderItemsSchema.productId,
        productName: orderItemsSchema.productName,
        productSku: orderItemsSchema.productSku,
        unitsSold: unitsExpression,
        grossItemRevenue: revenueExpression,
        currentStockOnHand: inventoryItemsSchema.quantityOnHand,
        productMedia: productsSchema.media,
      })
      .from(orderItemsSchema)
      .innerJoin(ordersSchema, eq(orderItemsSchema.orderId, ordersSchema.id))
      .leftJoin(
        productsSchema,
        eq(orderItemsSchema.productId, productsSchema.id),
      )
      .leftJoin(
        inventoryItemsSchema,
        eq(inventoryItemsSchema.sku, orderItemsSchema.productSku),
      )
      .where(
        and(
          gte(ordersSchema.createdAt, range.current.start),
          lte(ordersSchema.createdAt, range.current.end),
          ne(ordersSchema.status, 'cancelled'),
        ),
      )
      .groupBy(
        orderItemsSchema.productId,
        orderItemsSchema.productName,
        orderItemsSchema.productSku,
        inventoryItemsSchema.quantityOnHand,
        productsSchema.media,
      )
      .orderBy(orderByClause)
      .limit(limit);

    const items: TopProductItem[] = rows.map((row) => {
      let thumbnailUrl: string | null = null;
      if (Array.isArray(row.productMedia) && row.productMedia.length > 0) {
        const thumb = (row.productMedia as ProductMediaPersistence[]).find(
          (m) => m.isThumbnail,
        );
        thumbnailUrl = thumb ? thumb.url : (row.productMedia[0]?.url ?? null);
      }

      const gross = Number(row.grossItemRevenue ?? 0);

      return {
        productId: row.productId,
        productName: row.productName,
        sku: row.productSku,
        unitsSold: Number(row.unitsSold ?? 0),
        grossItemRevenue: query.hasFinancialPermission ? gross : null,
        currentStockOnHand:
          row.currentStockOnHand !== null
            ? Number(row.currentStockOnHand)
            : null,
        thumbnailUrl,
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
      sortBy: effectiveSortBy,
      items,
    };
  }
}
