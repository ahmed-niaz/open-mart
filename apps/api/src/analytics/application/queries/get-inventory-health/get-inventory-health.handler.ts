import { Inject } from '@nestjs/common';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { and, asc, eq, lte, sql } from 'drizzle-orm';

import { GetInventoryHealthQuery } from './get-inventory-health.query.js';
import type {
  InventoryHealthResult,
  LowStockAlertItem,
} from './get-inventory-health.result.js';
import {
  DRIZZLE,
  type DrizzleDB,
} from '../../../../shared/infrastructure/database/postgres/drizzle.provider.js';
import { inventoryItemsSchema } from '../../../../shared/infrastructure/database/postgres/schema/inventory.schema.js';
import {
  productsSchema,
  type ProductMediaPersistence,
} from '../../../../shared/infrastructure/database/postgres/schema/product.schema.js';

@QueryHandler(GetInventoryHealthQuery)
export class GetInventoryHealthHandler implements IQueryHandler<
  GetInventoryHealthQuery,
  InventoryHealthResult
> {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  async execute(
    query: GetInventoryHealthQuery,
  ): Promise<InventoryHealthResult> {
    const limit = Math.min(50, Math.max(1, query.limit));

    const [summaryRows, alertRows] = await Promise.all([
      // 1. Overall inventory summary & retail valuation
      this.db
        .select({
          totalSkus: sql<number>`COUNT(${inventoryItemsSchema.id})::int`,
          inStockSkus: sql<number>`COALESCE(SUM(CASE WHEN ${inventoryItemsSchema.quantityOnHand} > ${inventoryItemsSchema.lowStockThreshold} THEN 1 ELSE 0 END), 0)::int`,
          lowStockSkus: sql<number>`COALESCE(SUM(CASE WHEN ${inventoryItemsSchema.quantityOnHand} <= ${inventoryItemsSchema.lowStockThreshold} AND ${inventoryItemsSchema.quantityOnHand} > 0 THEN 1 ELSE 0 END), 0)::int`,
          outOfStockSkus: sql<number>`COALESCE(SUM(CASE WHEN ${inventoryItemsSchema.quantityOnHand} <= 0 THEN 1 ELSE 0 END), 0)::int`,
          totalUnitsOnHand: sql<number>`COALESCE(SUM(${inventoryItemsSchema.quantityOnHand}), 0)::int`,
          totalUnitsReserved: sql<number>`COALESCE(SUM(${inventoryItemsSchema.reservedQuantity}), 0)::int`,
          estimatedRetailValue: sql<string>`COALESCE(SUM(${inventoryItemsSchema.quantityOnHand} * ${productsSchema.unitPriceAmount}), 0)::text`,
        })
        .from(inventoryItemsSchema)
        .leftJoin(
          productsSchema,
          eq(inventoryItemsSchema.productId, productsSchema.id),
        )
        .where(eq(inventoryItemsSchema.isActive, true)),

      // 2. Urgent low-stock and out-of-stock items ranked by on-hand ascending
      this.db
        .select({
          id: inventoryItemsSchema.id,
          productId: inventoryItemsSchema.productId,
          productName: productsSchema.title,
          sku: inventoryItemsSchema.sku,
          quantityOnHand: inventoryItemsSchema.quantityOnHand,
          reservedQuantity: inventoryItemsSchema.reservedQuantity,
          lowStockThreshold: inventoryItemsSchema.lowStockThreshold,
          productMedia: productsSchema.media,
        })
        .from(inventoryItemsSchema)
        .innerJoin(
          productsSchema,
          eq(inventoryItemsSchema.productId, productsSchema.id),
        )
        .where(
          and(
            eq(inventoryItemsSchema.isActive, true),
            lte(
              inventoryItemsSchema.quantityOnHand,
              inventoryItemsSchema.lowStockThreshold,
            ),
          ),
        )
        .orderBy(asc(inventoryItemsSchema.quantityOnHand))
        .limit(limit),
    ]);

    const s = summaryRows[0];

    const lowStockAlerts: LowStockAlertItem[] = alertRows.map((row) => {
      let thumbnailUrl: string | null = null;
      if (Array.isArray(row.productMedia) && row.productMedia.length > 0) {
        const thumb = (row.productMedia as ProductMediaPersistence[]).find(
          (m) => m.isThumbnail,
        );
        thumbnailUrl = thumb ? thumb.url : (row.productMedia[0]?.url ?? null);
      }

      const onHand = Number(row.quantityOnHand ?? 0);
      const reserved = Number(row.reservedQuantity ?? 0);

      return {
        id: row.id,
        productId: row.productId,
        productName: row.productName ?? 'Unnamed Product',
        sku: row.sku,
        quantityOnHand: onHand,
        reservedQuantity: reserved,
        availableQuantity: Math.max(0, onHand - reserved),
        lowStockThreshold: Number(row.lowStockThreshold ?? 5),
        thumbnailUrl,
      };
    });

    return {
      currency: 'BDT',
      currencyUnit: 'poisha',
      summary: {
        totalSkus: Number(s?.totalSkus ?? 0),
        inStockSkus: Number(s?.inStockSkus ?? 0),
        lowStockSkus: Number(s?.lowStockSkus ?? 0),
        outOfStockSkus: Number(s?.outOfStockSkus ?? 0),
        totalUnitsOnHand: Number(s?.totalUnitsOnHand ?? 0),
        totalUnitsReserved: Number(s?.totalUnitsReserved ?? 0),
        estimatedRetailValue: Number(s?.estimatedRetailValue ?? 0),
      },
      lowStockAlerts,
    };
  }
}
