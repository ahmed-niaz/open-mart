import { Inject } from '@nestjs/common';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { and, desc, eq, sql } from 'drizzle-orm';

import { ListAdminUsersQuery } from './list-admin-users.query.js';
import {
  DRIZZLE,
  type DrizzleDB,
} from '../../../../shared/infrastructure/database/postgres/drizzle.provider.js';
import { adminUsersSchema } from '../../../../shared/infrastructure/database/postgres/schema/admin.schema.js';

export interface PaginatedAdminUsersResponse {
  items: Array<{
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    fullName: string;
    role: string;
    phoneNumber: string | null;
    avatarUrl: string | null;
    isActive: boolean;
    mustChangePassword: boolean;
    lastLoginAt: Date | null;
    createdAt: Date;
  }>;
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

@QueryHandler(ListAdminUsersQuery)
export class ListAdminUsersQueryHandler implements IQueryHandler<
  ListAdminUsersQuery,
  PaginatedAdminUsersResponse
> {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  async execute(
    query: ListAdminUsersQuery,
  ): Promise<PaginatedAdminUsersResponse> {
    const page = Math.max(1, query.page || 1);
    const limit = Math.min(100, Math.max(1, query.limit || 20));
    const offset = (page - 1) * limit;

    const conditions: any[] = [];

    if (query.search?.trim()) {
      const term = `%${query.search.trim()}%`;
      conditions.push(
        sql`(${adminUsersSchema.email} ILIKE ${term} OR ${adminUsersSchema.firstName} ILIKE ${term} OR ${adminUsersSchema.lastName} ILIKE ${term})`,
      );
    }

    if (query.role?.trim()) {
      conditions.push(eq(adminUsersSchema.role, query.role.trim()));
    }

    if (query.isActive !== undefined) {
      conditions.push(eq(adminUsersSchema.isActive, query.isActive));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const countResult = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(adminUsersSchema)
      .where(whereClause);

    const total = Number(countResult[0]?.count ?? 0);

    const rows = await this.db
      .select({
        id: adminUsersSchema.id,
        email: adminUsersSchema.email,
        firstName: adminUsersSchema.firstName,
        lastName: adminUsersSchema.lastName,
        role: adminUsersSchema.role,
        phoneNumber: adminUsersSchema.phoneNumber,
        avatarUrl: adminUsersSchema.avatarUrl,
        isActive: adminUsersSchema.isActive,
        mustChangePassword: adminUsersSchema.mustChangePassword,
        lastLoginAt: adminUsersSchema.lastLoginAt,
        createdAt: adminUsersSchema.createdAt,
      })
      .from(adminUsersSchema)
      .where(whereClause)
      .orderBy(desc(adminUsersSchema.createdAt))
      .limit(limit)
      .offset(offset);

    const items = rows.map((r) => ({
      ...r,
      fullName: `${r.firstName} ${r.lastName}`.trim(),
    }));

    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }
}
