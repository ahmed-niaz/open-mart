import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { and, count, desc, eq, ilike, max, or, sql } from 'drizzle-orm';
import type { SQL } from 'drizzle-orm';

import { ListAdminCustomersQuery } from './list-admin-customers.query.js';
import {
  DRIZZLE,
  type DrizzleDB,
} from '../../../../shared/infrastructure/database/postgres/drizzle.provider.js';
import { customersSchema } from '../../../../shared/infrastructure/database/postgres/schema/customer.schema.js';
import { ordersSchema } from '../../../../shared/infrastructure/database/postgres/schema/order.schema.js';
import { PaginatedResult } from '../../../../shared/application/pagination/paginated-result.js';
import type { AdminCustomerListItemDto } from '../../dto/admin-customer-list-item.dto.js';

@QueryHandler(ListAdminCustomersQuery)
export class ListAdminCustomersHandler implements IQueryHandler<
  ListAdminCustomersQuery,
  PaginatedResult<AdminCustomerListItemDto>
> {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  async execute(
    query: ListAdminCustomersQuery,
  ): Promise<PaginatedResult<AdminCustomerListItemDto>> {
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

    const [countResult] = await this.db
      .select({ total: count() })
      .from(customersSchema)
      .where(whereClause);

    const total = Number(countResult?.total ?? 0);

    const rows = await this.db
      .select({
        id: customersSchema.id,
        email: customersSchema.email,
        firstName: customersSchema.firstName,
        lastName: customersSchema.lastName,
        phoneNumber: customersSchema.phoneNumber,
        avatarUrl: customersSchema.avatarUrl,
        isActive: customersSchema.isActive,
        isEmailVerified: customersSchema.isEmailVerified,
        isGoogleLinked: sql<boolean>`${customersSchema.googleId} is not null`,
        createdAt: customersSchema.createdAt,
        totalOrders: count(ordersSchema.id),
        totalSpentCents: sql<number>`coalesce(sum(case when ${ordersSchema.status} != 'cancelled' then ${ordersSchema.totalAmount} else 0 end), 0)::int`,
        lastOrderAt: max(ordersSchema.createdAt),
      })
      .from(customersSchema)
      .leftJoin(ordersSchema, eq(ordersSchema.customerId, customersSchema.id))
      .where(whereClause)
      .groupBy(customersSchema.id)
      .orderBy(desc(customersSchema.createdAt))
      .limit(query.limit)
      .offset(query.offset);

    const items: AdminCustomerListItemDto[] = rows.map((r) => {
      const totalSpentCents = Number(r.totalSpentCents ?? 0);
      return {
        id: r.id,
        email: r.email,
        firstName: r.firstName,
        lastName: r.lastName,
        fullName: [r.firstName, r.lastName].filter(Boolean).join(' ').trim(),
        phoneNumber: r.phoneNumber,
        avatarUrl: r.avatarUrl,
        isActive: r.isActive,
        isEmailVerified: r.isEmailVerified,
        isGoogleLinked: Boolean(r.isGoogleLinked),
        totalOrders: Number(r.totalOrders ?? 0),
        totalSpentCents,
        totalSpentBDT: Math.round(totalSpentCents / 100),
        currency: 'BDT',
        lastOrderAt: r.lastOrderAt
          ? new Date(r.lastOrderAt).toISOString()
          : null,
        createdAt: r.createdAt.toISOString(),
      };
    });

    return PaginatedResult.create(items, total, query.page, query.limit);
  }
}
