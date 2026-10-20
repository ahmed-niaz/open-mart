import { Inject } from '@nestjs/common';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { eq } from 'drizzle-orm';

import { GetInventoryBySkuQuery } from './get-inventory-by-sku.query.js';
import {
  DRIZZLE,
  type DrizzleDB,
} from '../../../../shared/infrastructure/database/postgres/drizzle.provider.js';
import { inventoryItemsSchema } from '../../../../shared/infrastructure/database/postgres/schema/inventory.schema.js';
import { productsSchema } from '../../../../shared/infrastructure/database/postgres/schema/product.schema.js';
import {
  ApplicationException,
  ApplicationExceptionCode,
} from '../../../../shared/domain/exceptions/application.exception.js';

export interface InventoryDetailsDto {
  id: string;
  productId: string;
  productTitle: string;
  sku: string;
  quantityOnHand: number;
  reservedQuantity: number;
  availableQuantity: number;
  lowStockThreshold: number;
  isActive: boolean;
  version: number;
  status: 'in_stock' | 'low_stock' | 'out_of_stock';
  updatedAt: Date;
}

@QueryHandler(GetInventoryBySkuQuery)
export class GetInventoryBySkuQueryHandler implements IQueryHandler<
  GetInventoryBySkuQuery,
  InventoryDetailsDto
> {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  async execute(query: GetInventoryBySkuQuery): Promise<InventoryDetailsDto> {
    const normalizedSku = query.sku.trim().toUpperCase();

    const rows = await this.db
      .select({
        id: inventoryItemsSchema.id,
        productId: inventoryItemsSchema.productId,
        productTitle: productsSchema.title,
        sku: inventoryItemsSchema.sku,
        quantityOnHand: inventoryItemsSchema.quantityOnHand,
        reservedQuantity: inventoryItemsSchema.reservedQuantity,
        lowStockThreshold: inventoryItemsSchema.lowStockThreshold,
        isActive: inventoryItemsSchema.isActive,
        version: inventoryItemsSchema.version,
        updatedAt: inventoryItemsSchema.updatedAt,
      })
      .from(inventoryItemsSchema)
      .leftJoin(
        productsSchema,
        eq(inventoryItemsSchema.productId, productsSchema.id),
      )
      .where(eq(inventoryItemsSchema.sku, normalizedSku))
      .limit(1);

    if (rows.length === 0) {
      throw new ApplicationException(
        `Inventory item for SKU '${normalizedSku}' not found`,
        ApplicationExceptionCode.NOT_FOUND,
      );
    }

    const row = rows[0];
    const availableQuantity = row.quantityOnHand - row.reservedQuantity;

    let status: 'in_stock' | 'low_stock' | 'out_of_stock' = 'in_stock';
    if (availableQuantity <= 0) {
      status = 'out_of_stock';
    } else if (availableQuantity <= row.lowStockThreshold) {
      status = 'low_stock';
    }

    return {
      id: row.id,
      productId: row.productId,
      productTitle: row.productTitle ?? 'Untitled Product',
      sku: row.sku,
      quantityOnHand: row.quantityOnHand,
      reservedQuantity: row.reservedQuantity,
      availableQuantity,
      lowStockThreshold: row.lowStockThreshold,
      isActive: row.isActive,
      version: row.version,
      status,
      updatedAt: row.updatedAt,
    };
  }
}
