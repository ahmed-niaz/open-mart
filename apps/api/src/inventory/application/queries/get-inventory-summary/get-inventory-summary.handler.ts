import { Inject } from '@nestjs/common';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { eq, sql } from 'drizzle-orm';

import { GetInventorySummaryQuery } from './get-inventory-summary.query.js';
import {
  DRIZZLE,
  type DrizzleDB,
} from '../../../../shared/infrastructure/database/postgres/drizzle.provider.js';
import { inventoryItemsSchema } from '../../../../shared/infrastructure/database/postgres/schema/inventory.schema.js';
import { productsSchema } from '../../../../shared/infrastructure/database/postgres/schema/product.schema.js';

export interface InventorySummaryDto {
  totalSkus: number;
  inStockSkus: number;
  lowStockSkus: number;
  outOfStockSkus: number;
  totalUnitsOnHand: number;
  totalUnitsReserved: number;
  totalUnitsAvailable: number;
  estimatedRetailValueCents: number;
  estimatedRetailValueBDT: number;
}

@QueryHandler(GetInventorySummaryQuery)
export class GetInventorySummaryQueryHandler implements IQueryHandler<
  GetInventorySummaryQuery,
  InventorySummaryDto
> {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  async execute(): Promise<InventorySummaryDto> {
    const rows = await this.db
      .select({
        totalSkus: sql<number>`COUNT(${inventoryItemsSchema.id})::int`,
        inStockSkus: sql<number>`COALESCE(SUM(CASE WHEN (${inventoryItemsSchema.quantityOnHand} - ${inventoryItemsSchema.reservedQuantity}) > ${inventoryItemsSchema.lowStockThreshold} THEN 1 ELSE 0 END), 0)::int`,
        lowStockSkus: sql<number>`COALESCE(SUM(CASE WHEN (${inventoryItemsSchema.quantityOnHand} - ${inventoryItemsSchema.reservedQuantity}) > 0 AND (${inventoryItemsSchema.quantityOnHand} - ${inventoryItemsSchema.reservedQuantity}) <= ${inventoryItemsSchema.lowStockThreshold} THEN 1 ELSE 0 END), 0)::int`,
        outOfStockSkus: sql<number>`COALESCE(SUM(CASE WHEN (${inventoryItemsSchema.quantityOnHand} - ${inventoryItemsSchema.reservedQuantity}) <= 0 THEN 1 ELSE 0 END), 0)::int`,
        totalUnitsOnHand: sql<number>`COALESCE(SUM(${inventoryItemsSchema.quantityOnHand}), 0)::int`,
        totalUnitsReserved: sql<number>`COALESCE(SUM(${inventoryItemsSchema.reservedQuantity}), 0)::int`,
        totalUnitsAvailable: sql<number>`COALESCE(SUM(GREATEST(${inventoryItemsSchema.quantityOnHand} - ${inventoryItemsSchema.reservedQuantity}, 0)), 0)::int`,
        estimatedRetailValueCents: sql<string>`COALESCE(SUM(${inventoryItemsSchema.quantityOnHand} * ${productsSchema.unitPriceAmount}), 0)::text`,
      })
      .from(inventoryItemsSchema)
      .leftJoin(
        productsSchema,
        eq(inventoryItemsSchema.productId, productsSchema.id),
      )
      .where(eq(inventoryItemsSchema.isActive, true));

    const s = rows[0];
    const totalValCents = Number(s?.estimatedRetailValueCents ?? 0);

    return {
      totalSkus: Number(s?.totalSkus ?? 0),
      inStockSkus: Number(s?.inStockSkus ?? 0),
      lowStockSkus: Number(s?.lowStockSkus ?? 0),
      outOfStockSkus: Number(s?.outOfStockSkus ?? 0),
      totalUnitsOnHand: Number(s?.totalUnitsOnHand ?? 0),
      totalUnitsReserved: Number(s?.totalUnitsReserved ?? 0),
      totalUnitsAvailable: Number(s?.totalUnitsAvailable ?? 0),
      estimatedRetailValueCents: totalValCents,
      estimatedRetailValueBDT: Math.round(totalValCents / 100),
    };
  }
}
