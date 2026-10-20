import { Inject } from '@nestjs/common';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { and, desc, eq, sql } from 'drizzle-orm';

import { ListInventoryQuery } from './list-inventory.query.js';
import {
  DRIZZLE,
  type DrizzleDB,
} from '../../../../shared/infrastructure/database/postgres/drizzle.provider.js';
import { inventoryItemsSchema } from '../../../../shared/infrastructure/database/postgres/schema/inventory.schema.js';
import { productsSchema } from '../../../../shared/infrastructure/database/postgres/schema/product.schema.js';

export interface PaginatedInventoryResponse {
  items: Array<{
    id: string;
    productId: string;
    productTitle: string;
    sku: string;
    quantityOnHand: number;
    reservedQuantity: number;
    availableQuantity: number;
    lowStockThreshold: number;
    isActive: boolean;
    status: 'in_stock' | 'low_stock' | 'out_of_stock';
  }>;
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

@QueryHandler(ListInventoryQuery)
export class ListInventoryQueryHandler implements IQueryHandler<
  ListInventoryQuery,
  PaginatedInventoryResponse
> {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  async execute(
    query: ListInventoryQuery,
  ): Promise<PaginatedInventoryResponse> {
    const page = Math.max(1, query.page || 1);
    const limit = Math.min(100, Math.max(1, query.limit || 20));
    const offset = (page - 1) * limit;

    const conditions: any[] = [];

    if (query.search?.trim()) {
      const term = `%${query.search.trim()}%`;
      conditions.push(
        sql`(${inventoryItemsSchema.sku} ILIKE ${term} OR ${productsSchema.title} ILIKE ${term})`,
      );
    }

    if (query.status === 'out_of_stock') {
      conditions.push(
        sql`(${inventoryItemsSchema.quantityOnHand} - ${inventoryItemsSchema.reservedQuantity}) <= 0`,
      );
    } else if (query.status === 'low_stock') {
      conditions.push(
        sql`(${inventoryItemsSchema.quantityOnHand} - ${inventoryItemsSchema.reservedQuantity}) > 0 AND (${inventoryItemsSchema.quantityOnHand} - ${inventoryItemsSchema.reservedQuantity}) <= ${inventoryItemsSchema.lowStockThreshold}`,
      );
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    // Total count
    const countResult = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(inventoryItemsSchema)
      .leftJoin(
        productsSchema,
        eq(inventoryItemsSchema.productId, productsSchema.id),
      )
      .where(whereClause);

    const total = Number(countResult[0]?.count ?? 0);

    // Paginated rows
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
      })
      .from(inventoryItemsSchema)
      .leftJoin(
        productsSchema,
        eq(inventoryItemsSchema.productId, productsSchema.id),
      )
      .where(whereClause)
      .orderBy(desc(inventoryItemsSchema.updatedAt))
      .limit(limit)
      .offset(offset);

    const items = rows.map((r: any) => {
      const availableQuantity = r.quantityOnHand - r.reservedQuantity;
      let status: 'in_stock' | 'low_stock' | 'out_of_stock' = 'in_stock';
      if (availableQuantity <= 0) {
        status = 'out_of_stock';
      } else if (availableQuantity <= r.lowStockThreshold) {
        status = 'low_stock';
      }

      return {
        id: r.id,
        productId: r.productId,
        productTitle: r.productTitle ?? 'Untitled Product',
        sku: r.sku,
        quantityOnHand: r.quantityOnHand,
        reservedQuantity: r.reservedQuantity,
        availableQuantity,
        lowStockThreshold: r.lowStockThreshold,
        isActive: r.isActive,
        status,
      };
    });

    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }
}
