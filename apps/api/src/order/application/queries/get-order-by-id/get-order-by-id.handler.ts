import { Inject } from '@nestjs/common';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { eq } from 'drizzle-orm';
import { GetOrderByIdQuery } from './get-order-by-id.query.js';
import { OrderResponseDto } from '../../dto/order-response.dto.js';
import {
  DRIZZLE,
  type DrizzleDB,
} from '../../../../shared/infrastructure/database/postgres/drizzle.provider.js';
import {
  orderItemsSchema,
  ordersSchema,
} from '../../../../shared/infrastructure/database/postgres/schema/order.schema.js';
import {
  ApplicationException,
  ApplicationExceptionCode,
} from '../../../../shared/domain/exceptions/application.exception.js';

@QueryHandler(GetOrderByIdQuery)
export class GetOrderByIdQueryHandler implements IQueryHandler<
  GetOrderByIdQuery,
  OrderResponseDto
> {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  async execute(query: GetOrderByIdQuery): Promise<OrderResponseDto> {
    const orders = await this.db
      .select()
      .from(ordersSchema)
      .where(eq(ordersSchema.id, query.orderId))
      .limit(1);

    if (orders.length === 0) {
      throw new ApplicationException(
        `Order with ID '${query.orderId}' not found`,
        ApplicationExceptionCode.NOT_FOUND,
      );
    }

    const orderRow = orders[0];

    // Ownership authorization check
    if (
      !query.isAdmin &&
      query.requestingCustomerId &&
      orderRow.customerId !== query.requestingCustomerId
    ) {
      throw new ApplicationException(
        'Forbidden: You are not authorized to view another customer order',
        ApplicationExceptionCode.FORBIDDEN,
      );
    }

    const itemRows = await this.db
      .select()
      .from(orderItemsSchema)
      .where(eq(orderItemsSchema.orderId, query.orderId));

    return OrderResponseDto.fromPersistence(orderRow, itemRows);
  }
}
