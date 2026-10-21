import { Inject } from '@nestjs/common';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { desc, eq, sql } from 'drizzle-orm';

import { ListDiscountRedemptionsQuery } from './list-discount-redemptions.query.js';
import {
  DRIZZLE,
  type DrizzleDB,
} from '../../../../shared/infrastructure/database/postgres/drizzle.provider.js';
import { discountRedemptionsSchema } from '../../../../shared/infrastructure/database/postgres/schema/discount.schema.js';
import { customersSchema } from '../../../../shared/infrastructure/database/postgres/schema/customer.schema.js';

export interface DiscountRedemptionListItem {
  id: string;
  orderId: string;
  customerId: string | null;
  customerIdentifier: string;
  customerEmail: string | null;
  discountCode: string;
  discountAmount: number;
  status: string;
  reservedAt: Date;
  confirmedAt: Date | null;
  releasedAt: Date | null;
}

export interface PaginatedDiscountRedemptionsResponse {
  items: DiscountRedemptionListItem[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

@QueryHandler(ListDiscountRedemptionsQuery)
export class ListDiscountRedemptionsQueryHandler implements IQueryHandler<
  ListDiscountRedemptionsQuery,
  PaginatedDiscountRedemptionsResponse
> {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  async execute(
    query: ListDiscountRedemptionsQuery,
  ): Promise<PaginatedDiscountRedemptionsResponse> {
    const page = Math.max(1, query.page || 1);
    const limit = Math.min(100, Math.max(1, query.limit || 20));
    const offset = (page - 1) * limit;

    const countResult = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(discountRedemptionsSchema)
      .where(eq(discountRedemptionsSchema.discountId, query.discountId));

    const total = Number(countResult[0]?.count ?? 0);

    const rows = await this.db
      .select({
        id: discountRedemptionsSchema.id,
        orderId: discountRedemptionsSchema.orderId,
        customerId: discountRedemptionsSchema.customerId,
        customerIdentifier: discountRedemptionsSchema.customerIdentifier,
        customerEmail: customersSchema.email,
        discountCode: discountRedemptionsSchema.discountCode,
        discountAmount: discountRedemptionsSchema.discountAmount,
        status: discountRedemptionsSchema.status,
        reservedAt: discountRedemptionsSchema.reservedAt,
        confirmedAt: discountRedemptionsSchema.confirmedAt,
        releasedAt: discountRedemptionsSchema.releasedAt,
      })
      .from(discountRedemptionsSchema)
      .leftJoin(
        customersSchema,
        eq(discountRedemptionsSchema.customerId, customersSchema.id),
      )
      .where(eq(discountRedemptionsSchema.discountId, query.discountId))
      .orderBy(desc(discountRedemptionsSchema.reservedAt))
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
