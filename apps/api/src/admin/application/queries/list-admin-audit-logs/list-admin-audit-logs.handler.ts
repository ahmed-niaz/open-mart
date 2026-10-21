import { Inject } from '@nestjs/common';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { and, desc, eq, sql } from 'drizzle-orm';

import { ListAdminAuditLogsQuery } from './list-admin-audit-logs.query.js';
import {
  DRIZZLE,
  type DrizzleDB,
} from '../../../../shared/infrastructure/database/postgres/drizzle.provider.js';
import {
  adminAuditLogsSchema,
  adminUsersSchema,
} from '../../../../shared/infrastructure/database/postgres/schema/admin.schema.js';

export interface PaginatedAdminAuditLogsResponse {
  items: Array<{
    id: string;
    adminId: string;
    adminEmail: string | null;
    action: string;
    targetId: string | null;
    details: unknown;
    ipAddress: string | null;
    userAgent: string | null;
    createdAt: Date;
  }>;
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

@QueryHandler(ListAdminAuditLogsQuery)
export class ListAdminAuditLogsQueryHandler implements IQueryHandler<
  ListAdminAuditLogsQuery,
  PaginatedAdminAuditLogsResponse
> {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  async execute(
    query: ListAdminAuditLogsQuery,
  ): Promise<PaginatedAdminAuditLogsResponse> {
    const page = Math.max(1, query.page || 1);
    const limit = Math.min(100, Math.max(1, query.limit || 20));
    const offset = (page - 1) * limit;

    const conditions: any[] = [];

    if (query.adminId) {
      conditions.push(eq(adminAuditLogsSchema.adminId, query.adminId));
    }

    if (query.action?.trim()) {
      conditions.push(eq(adminAuditLogsSchema.action, query.action.trim()));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const countResult = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(adminAuditLogsSchema)
      .where(whereClause);

    const total = Number(countResult[0]?.count ?? 0);

    const rows = await this.db
      .select({
        id: adminAuditLogsSchema.id,
        adminId: adminAuditLogsSchema.adminId,
        adminEmail: adminUsersSchema.email,
        action: adminAuditLogsSchema.action,
        targetId: adminAuditLogsSchema.targetId,
        details: adminAuditLogsSchema.details,
        ipAddress: adminAuditLogsSchema.ipAddress,
        userAgent: adminAuditLogsSchema.userAgent,
        createdAt: adminAuditLogsSchema.createdAt,
      })
      .from(adminAuditLogsSchema)
      .leftJoin(
        adminUsersSchema,
        eq(adminAuditLogsSchema.adminId, adminUsersSchema.id),
      )
      .where(whereClause)
      .orderBy(desc(adminAuditLogsSchema.createdAt))
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
