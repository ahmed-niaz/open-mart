import { Inject } from '@nestjs/common';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { desc, eq, sql } from 'drizzle-orm';

import { GetInventoryMovementsQuery } from './get-inventory-movements.query.js';
import {
  DRIZZLE,
  type DrizzleDB,
} from '../../../../shared/infrastructure/database/postgres/drizzle.provider.js';
import { inventoryMovementsSchema } from '../../../../shared/infrastructure/database/postgres/schema/inventory.schema.js';

export interface PaginatedMovementsResponse {
  sku: string;
  movements: Array<{
    id: string;
    reason: string;
    onHandDelta: number;
    reservedDelta: number;
    onHandAfter: number;
    reservedAfter: number;
    actorId: string | null;
    referenceType: string;
    referenceId: string;
    note: string | null;
    createdAt: Date;
  }>;
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

@QueryHandler(GetInventoryMovementsQuery)
export class GetInventoryMovementsQueryHandler implements IQueryHandler<
  GetInventoryMovementsQuery,
  PaginatedMovementsResponse
> {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  async execute(
    query: GetInventoryMovementsQuery,
  ): Promise<PaginatedMovementsResponse> {
    const normalizedSku = query.sku.trim().toUpperCase();
    const page = Math.max(1, query.page || 1);
    const limit = Math.min(100, Math.max(1, query.limit || 20));
    const offset = (page - 1) * limit;

    const countResult = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(inventoryMovementsSchema)
      .where(eq(inventoryMovementsSchema.sku, normalizedSku));

    const total = Number(countResult[0]?.count ?? 0);

    const rows = await this.db
      .select()
      .from(inventoryMovementsSchema)
      .where(eq(inventoryMovementsSchema.sku, normalizedSku))
      .orderBy(desc(inventoryMovementsSchema.createdAt))
      .limit(limit)
      .offset(offset);

    const movements = rows.map((r: any) => ({
      id: r.id,
      reason: r.reason,
      onHandDelta: r.onHandDelta,
      reservedDelta: r.reservedDelta,
      onHandAfter: r.onHandAfter,
      reservedAfter: r.reservedAfter,
      actorId: r.actorId,
      referenceType: r.referenceType,
      referenceId: r.referenceId,
      note: r.note,
      createdAt: r.createdAt,
    }));

    return {
      sku: normalizedSku,
      movements,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }
}
