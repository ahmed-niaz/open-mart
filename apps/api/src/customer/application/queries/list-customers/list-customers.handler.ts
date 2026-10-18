import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { and, count, desc, eq, ilike, or } from 'drizzle-orm';
import type { SQL } from 'drizzle-orm';

import { ListCustomersQuery } from './list-customers.query.js';
import {
  DRIZZLE,
  type DrizzleDB,
} from '../../../../shared/infrastructure/database/postgres/drizzle.provider.js';
import { customersSchema } from '../../../../shared/infrastructure/database/postgres/schema/customer.schema.js';
import { PaginatedResult } from '../../../../shared/application/pagination/paginated-result.js';
import { CustomerResponseDto } from '../../dto/customer-response.dto.js';

@QueryHandler(ListCustomersQuery)
export class ListCustomersHandler implements IQueryHandler<
  ListCustomersQuery,
  PaginatedResult<CustomerResponseDto>
> {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  async execute(
    query: ListCustomersQuery,
  ): Promise<PaginatedResult<CustomerResponseDto>> {
    const conditions: SQL[] = [];

    if (query.isActive !== undefined) {
      conditions.push(eq(customersSchema.isActive, query.isActive));
    }

    if (query.search && query.search.trim().length > 0) {
      const term = `%${query.search.trim()}%`;
      conditions.push(
        or(
          ilike(customersSchema.firstName, term),
          ilike(customersSchema.lastName, term),
          ilike(customersSchema.email, term),
          ilike(customersSchema.phoneNumber, term),
        )!,
      );
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const [[countResult], rows] = await Promise.all([
      this.db
        .select({ total: count() })
        .from(customersSchema)
        .where(whereClause),
      this.db
        .select()
        .from(customersSchema)
        .where(whereClause)
        .orderBy(desc(customersSchema.createdAt))
        .limit(query.limit)
        .offset(query.offset),
    ]);

    const total = Number(countResult?.total ?? 0);
    const dtos = rows.map((row) => CustomerResponseDto.fromPersistence(row));

    return PaginatedResult.create(dtos, total, query.page, query.limit);
  }
}
