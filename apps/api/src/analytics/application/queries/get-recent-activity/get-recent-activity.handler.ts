import { Inject } from '@nestjs/common';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { desc, eq } from 'drizzle-orm';

import { GetRecentActivityQuery } from './get-recent-activity.query.js';
import type {
  ActivityFeedItem,
  RecentActivityResult,
} from './get-recent-activity.result.js';
import {
  DRIZZLE,
  type DrizzleDB,
} from '../../../../shared/infrastructure/database/postgres/drizzle.provider.js';
import {
  ordersSchema,
  orderStatusHistorySchema,
} from '../../../../shared/infrastructure/database/postgres/schema/order.schema.js';
import { paymentsSchema } from '../../../../shared/infrastructure/database/postgres/schema/payment.schema.js';
import {
  adminAuditLogsSchema,
  adminUsersSchema,
} from '../../../../shared/infrastructure/database/postgres/schema/admin.schema.js';

@QueryHandler(GetRecentActivityQuery)
export class GetRecentActivityHandler implements IQueryHandler<
  GetRecentActivityQuery,
  RecentActivityResult
> {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  async execute(query: GetRecentActivityQuery): Promise<RecentActivityResult> {
    const limit = Math.min(50, Math.max(1, query.limit));
    // Fetch limit + 1 from each source to support pagination and merge
    const fetchLimit = limit + 5;

    // Decode cursor if provided (base64 string containing `${timestamp}_${id}`)
    let cursorTime: Date | null = null;
    let cursorId: string | null = null;
    if (query.cursor) {
      try {
        const decoded = Buffer.from(query.cursor, 'base64').toString('utf8');
        const [timePart, idPart] = decoded.split('_');
        const parsedTime = new Date(timePart);
        if (!isNaN(parsedTime.getTime()) && idPart) {
          cursorTime = parsedTime;
          cursorId = idPart;
        }
      } catch {
        // Invalid cursor ignored
      }
    }

    const promises: Promise<ActivityFeedItem[]>[] = [];

    // 1. Order Status Transition Stream
    promises.push(
      this.db
        .select({
          id: orderStatusHistorySchema.id,
          orderId: orderStatusHistorySchema.orderId,
          fromStatus: orderStatusHistorySchema.fromStatus,
          toStatus: orderStatusHistorySchema.toStatus,
          changedBy: orderStatusHistorySchema.changedBy,
          reason: orderStatusHistorySchema.reason,
          changedAt: orderStatusHistorySchema.changedAt,
          recipientName: ordersSchema.recipientName,
        })
        .from(orderStatusHistorySchema)
        .innerJoin(
          ordersSchema,
          eq(orderStatusHistorySchema.orderId, ordersSchema.id),
        )
        .orderBy(desc(orderStatusHistorySchema.changedAt))
        .limit(fetchLimit)
        .then((rows) =>
          rows.map((r) => ({
            id: r.id,
            type: 'order' as const,
            title: `Order status moved to ${r.toStatus}`,
            description: `Order ${r.orderId.slice(0, 8)} for ${r.recipientName} transitioned from ${r.fromStatus || 'none'} to ${r.toStatus}`,
            timestamp: r.changedAt.toISOString(),
            metadata: {
              orderId: r.orderId,
              fromStatus: r.fromStatus,
              toStatus: r.toStatus,
              changedBy: r.changedBy,
              reason: r.reason,
            },
          })),
        ),
    );

    // 2. Payment Event Stream (Only if caller has financial permission)
    if (query.hasFinancialPermission) {
      promises.push(
        this.db
          .select({
            id: paymentsSchema.id,
            orderId: paymentsSchema.orderId,
            provider: paymentsSchema.provider,
            status: paymentsSchema.status,
            amount: paymentsSchema.amount,
            paidAt: paymentsSchema.paidAt,
            createdAt: paymentsSchema.createdAt,
            refundedAmount: paymentsSchema.refundedAmount,
          })
          .from(paymentsSchema)
          .orderBy(desc(paymentsSchema.createdAt))
          .limit(fetchLimit)
          .then((rows) =>
            rows.map((r) => {
              const eventTime = r.paidAt ?? r.createdAt;
              const isRefund =
                r.status === 'refunded' || r.status === 'partially_refunded';
              return {
                id: r.id,
                type: 'payment' as const,
                title: isRefund
                  ? `Refund of BDT ${(r.refundedAmount / 100).toFixed(2)} recorded`
                  : `Payment ${r.status} via ${r.provider}`,
                description: `Payment for order ${r.orderId.slice(0, 8)}: status ${r.status}, amount BDT ${(r.amount / 100).toFixed(2)}`,
                timestamp: eventTime.toISOString(),
                metadata: {
                  paymentId: r.id,
                  orderId: r.orderId,
                  provider: r.provider,
                  status: r.status,
                  amount: r.amount,
                  refundedAmount: r.refundedAmount,
                },
              };
            }),
          ),
      );
    }

    // 3. Admin Audit Log Stream (Only if caller has audit permission)
    if (query.hasAuditPermission) {
      promises.push(
        this.db
          .select({
            id: adminAuditLogsSchema.id,
            action: adminAuditLogsSchema.action,
            targetId: adminAuditLogsSchema.targetId,
            details: adminAuditLogsSchema.details,
            createdAt: adminAuditLogsSchema.createdAt,
            adminEmail: adminUsersSchema.email,
          })
          .from(adminAuditLogsSchema)
          .leftJoin(
            adminUsersSchema,
            eq(adminAuditLogsSchema.adminId, adminUsersSchema.id),
          )
          .orderBy(desc(adminAuditLogsSchema.createdAt))
          .limit(fetchLimit)
          .then((rows) =>
            rows.map((r) => ({
              id: r.id,
              type: 'admin_audit' as const,
              title: `Staff action: ${r.action}`,
              description: `Performed by ${r.adminEmail || 'admin'}${r.targetId ? ` on target ${r.targetId.slice(0, 8)}` : ''}`,
              timestamp: r.createdAt.toISOString(),
              metadata: {
                auditId: r.id,
                action: r.action,
                targetId: r.targetId,
                details: r.details,
                adminEmail: r.adminEmail,
              },
            })),
          ),
      );
    }

    const streamResults = await Promise.all(promises);
    const combined = streamResults.flat();

    // Sort by timestamp DESC, then id DESC for stable ordering
    combined.sort((a, b) => {
      const timeDiff =
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
      if (timeDiff !== 0) {
        return timeDiff;
      }
      return b.id.localeCompare(a.id);
    });

    // Apply cursor filtering if provided
    let filtered = combined;
    if (cursorTime && cursorId) {
      filtered = combined.filter((item) => {
        const itemTime = new Date(item.timestamp);
        if (itemTime < cursorTime) {
          return true;
        }
        if (itemTime.getTime() === cursorTime.getTime()) {
          return item.id < cursorId;
        }
        return false;
      });
    }

    const items = filtered.slice(0, limit);
    const hasMore = filtered.length > limit;

    let nextCursor: string | null = null;
    if (hasMore && items.length > 0) {
      const lastItem = items[items.length - 1];
      const cursorStr = `${lastItem.timestamp}_${lastItem.id}`;
      nextCursor = Buffer.from(cursorStr, 'utf8').toString('base64');
    }

    return {
      items,
      nextCursor,
      hasMore,
    };
  }
}
