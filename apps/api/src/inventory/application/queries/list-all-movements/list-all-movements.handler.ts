import { Inject } from '@nestjs/common';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { desc, eq, sql } from 'drizzle-orm';

import { ListAllMovementsQuery } from './list-all-movements.query.js';
import {
  DRIZZLE,
  type DrizzleDB,
} from '../../../../shared/infrastructure/database/postgres/drizzle.provider.js';
import {
  inventoryItemsSchema,
  inventoryMovementsSchema,
} from '../../../../shared/infrastructure/database/postgres/schema/inventory.schema.js';
import { productsSchema } from '../../../../shared/infrastructure/database/postgres/schema/product.schema.js';

export interface InventoryMovementItemDto {
  id: string;
  sku: string;
  productTitle: string;
  reason: string;
  type: string;
  onHandDelta: number;
  reservedDelta: number;
  quantityDelta: number;
  balanceAfter: number;
  onHandAfter: number;
  reservedAfter: number;
  actorId: string | null;
  referenceType: string;
  referenceId: string;
  note: string | null;
  createdAt: Date;
}

export interface PaginatedAllMovementsResponse {
  movements: InventoryMovementItemDto[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

@QueryHandler(ListAllMovementsQuery)
export class ListAllMovementsQueryHandler implements IQueryHandler<
  ListAllMovementsQuery,
  PaginatedAllMovementsResponse
> {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  async execute(
    query: ListAllMovementsQuery,
  ): Promise<PaginatedAllMovementsResponse> {
    const page = Math.max(1, query.page || 1);
    const limit = Math.min(100, Math.max(1, query.limit || 20));
    const offset = (page - 1) * limit;

    const whereClause = query.sku?.trim()
      ? eq(inventoryMovementsSchema.sku, query.sku.trim().toUpperCase())
      : undefined;

    const countResult = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(inventoryMovementsSchema)
      .where(whereClause);

    const total = Number(countResult[0]?.count ?? 0);

    const rows = await this.db
      .select({
        id: inventoryMovementsSchema.id,
        sku: inventoryMovementsSchema.sku,
        productTitle: productsSchema.title,
        reason: inventoryMovementsSchema.reason,
        onHandDelta: inventoryMovementsSchema.onHandDelta,
        reservedDelta: inventoryMovementsSchema.reservedDelta,
        onHandAfter: inventoryMovementsSchema.onHandAfter,
        reservedAfter: inventoryMovementsSchema.reservedAfter,
        actorId: inventoryMovementsSchema.actorId,
        referenceType: inventoryMovementsSchema.referenceType,
        referenceId: inventoryMovementsSchema.referenceId,
        note: inventoryMovementsSchema.note,
        createdAt: inventoryMovementsSchema.createdAt,
      })
      .from(inventoryMovementsSchema)
      .leftJoin(
        inventoryItemsSchema,
        eq(inventoryMovementsSchema.inventoryItemId, inventoryItemsSchema.id),
      )
      .leftJoin(
        productsSchema,
        eq(inventoryItemsSchema.productId, productsSchema.id),
      )
      .where(whereClause)
      .orderBy(desc(inventoryMovementsSchema.createdAt))
      .limit(limit)
      .offset(offset);

    const movements: InventoryMovementItemDto[] = rows.map((r) => {
      const qDelta = r.onHandDelta !== 0 ? r.onHandDelta : r.reservedDelta;
      return {
        id: r.id,
        sku: r.sku,
        productTitle: r.productTitle || 'Product',
        reason: r.reason,
        type: r.reason,
        onHandDelta: r.onHandDelta,
        reservedDelta: r.reservedDelta,
        quantityDelta: qDelta,
        balanceAfter: r.onHandAfter,
        onHandAfter: r.onHandAfter,
        reservedAfter: r.reservedAfter,
        actorId: r.actorId,
        referenceType: r.referenceType,
        referenceId: r.referenceId,
        note: r.note,
        createdAt: r.createdAt,
      };
    });

    return {
      movements,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    };
  }
}
