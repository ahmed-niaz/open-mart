import { Inject } from '@nestjs/common';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { and, desc, eq, ilike, or, sql } from 'drizzle-orm';

import { ListDiscountsQuery } from './list-discounts.query.js';
import {
  DRIZZLE,
  type DrizzleDB,
} from '../../../../shared/infrastructure/database/postgres/drizzle.provider.js';
import { discountsSchema } from '../../../../shared/infrastructure/database/postgres/schema/discount.schema.js';

export interface DiscountListItem {
  id: string;
  code: string;
  name: string;
  type: string;
  value: number | null;
  scope: string;
  status: string;
  currentUsageCount: number;
  maxUsageLimit: number | null;
  startsAt: Date;
  expiresAt: Date | null;
  createdAt: Date;
}

export interface PaginatedDiscountsResponse {
  items: DiscountListItem[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

@QueryHandler(ListDiscountsQuery)
export class ListDiscountsQueryHandler implements IQueryHandler<
  ListDiscountsQuery,
  PaginatedDiscountsResponse
> {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  async execute(
    query: ListDiscountsQuery,
  ): Promise<PaginatedDiscountsResponse> {
    const page = Math.max(1, query.page || 1);
    const limit = Math.min(100, Math.max(1, query.limit || 20));
    const offset = (page - 1) * limit;

    const conditions: any[] = [];

    if (query.status) {
      conditions.push(eq(discountsSchema.status, query.status));
    }

    if (query.type) {
      conditions.push(eq(discountsSchema.type, query.type));
    }

    if (query.search?.trim()) {
      const term = `%${query.search.trim()}%`;
      conditions.push(
        or(
          ilike(discountsSchema.code, term),
          ilike(discountsSchema.name, term),
        ),
      );
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const countResult = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(discountsSchema)
      .where(whereClause);

    const total = Number(countResult[0]?.count ?? 0);

    const rows = await this.db
      .select({
        id: discountsSchema.id,
        code: discountsSchema.code,
        name: discountsSchema.name,
        type: discountsSchema.type,
        value: discountsSchema.value,
        scope: discountsSchema.scope,
        status: discountsSchema.status,
        currentUsageCount: discountsSchema.currentUsageCount,
        maxUsageLimit: discountsSchema.maxUsageLimit,
        startsAt: discountsSchema.startsAt,
        expiresAt: discountsSchema.expiresAt,
        createdAt: discountsSchema.createdAt,
      })
      .from(discountsSchema)
      .where(whereClause)
      .orderBy(desc(discountsSchema.createdAt))
      .limit(limit)
      .offset(offset);

    return {
      items: rows,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }
}
