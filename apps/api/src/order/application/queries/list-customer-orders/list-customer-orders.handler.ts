import { Inject } from '@nestjs/common';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { and, count, desc, eq, inArray } from 'drizzle-orm';
import { ListCustomerOrdersQuery } from './list-customer-orders.query.js';
import { OrderResponseDto } from '../../dto/order-response.dto.js';
import { PaginatedResult } from '../../../../shared/application/pagination/paginated-result.js';
import {
  DRIZZLE,
  type DrizzleDB,
} from '../../../../shared/infrastructure/database/postgres/drizzle.provider.js';
import {
  orderItemsSchema,
  ordersSchema,
  type OrderSelectRow,
  type orderStatusEnum,
} from '../../../../shared/infrastructure/database/postgres/schema/order.schema.js';

@QueryHandler(ListCustomerOrdersQuery)
export class ListCustomerOrdersQueryHandler implements IQueryHandler<
  ListCustomerOrdersQuery,
  PaginatedResult<OrderResponseDto>
> {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  async execute(
    query: ListCustomerOrdersQuery,
  ): Promise<PaginatedResult<OrderResponseDto>> {
    const page = Math.max(1, query.page);
    const limit = Math.max(1, Math.min(100, query.limit));
    const offset = (page - 1) * limit;

    const conditions = [eq(ordersSchema.customerId, query.customerId)];

    if (query.status) {
      conditions.push(
        eq(
          ordersSchema.status,
          query.status as (typeof orderStatusEnum.enumValues)[number],
        ),
      );
    }

    const whereClause = and(...conditions);

    // Total count query
    const totalResult = await this.db
      .select({ count: count() })
      .from(ordersSchema)
      .where(whereClause);
    const total = totalResult[0]?.count ?? 0;

    // Paginated rows
    const orderRows: OrderSelectRow[] = await this.db
      .select()
      .from(ordersSchema)
      .where(whereClause)
      .orderBy(desc(ordersSchema.createdAt))
      .limit(limit)
      .offset(offset);

    if (orderRows.length === 0) {
      return PaginatedResult.create([], total, page, limit);
    }

    const orderIds = orderRows.map((o) => o.id);
    const itemRows = await this.db
      .select()
      .from(orderItemsSchema)
      .where(inArray(orderItemsSchema.orderId, orderIds));

    // Group items by orderId
    const itemsByOrderId = new Map<string, typeof itemRows>();
    for (const item of itemRows) {
      const items = itemsByOrderId.get(item.orderId) ?? [];
      items.push(item);
      itemsByOrderId.set(item.orderId, items);
    }

    const dtos = orderRows.map((order) =>
      OrderResponseDto.fromPersistence(
        order,
        itemsByOrderId.get(order.id) ?? [],
      ),
    );

    return PaginatedResult.create(dtos, total, page, limit);
  }
}
