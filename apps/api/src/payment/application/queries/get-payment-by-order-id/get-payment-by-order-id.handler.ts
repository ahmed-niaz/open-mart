import { Inject } from '@nestjs/common';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { desc, eq } from 'drizzle-orm';

import { GetPaymentByOrderIdQuery } from './get-payment-by-order-id.query.js';
import { PaymentDetailsDto } from '../../dto/payment-details.dto.js';
import {
  DRIZZLE,
  type DrizzleDB,
} from '../../../../shared/infrastructure/database/postgres/drizzle.provider.js';
import { paymentsSchema } from '../../../../shared/infrastructure/database/postgres/schema/payment.schema.js';
import {
  ApplicationException,
  ApplicationExceptionCode,
} from '../../../../shared/domain/exceptions/application.exception.js';

@QueryHandler(GetPaymentByOrderIdQuery)
export class GetPaymentByOrderIdQueryHandler
  implements IQueryHandler<GetPaymentByOrderIdQuery, PaymentDetailsDto>
{
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  async execute(query: GetPaymentByOrderIdQuery): Promise<PaymentDetailsDto> {
    const rows = await this.db
      .select()
      .from(paymentsSchema)
      .where(eq(paymentsSchema.orderId, query.orderId))
      .orderBy(desc(paymentsSchema.createdAt))
      .limit(1);

    if (rows.length === 0) {
      throw new ApplicationException(
        `Payment for order '${query.orderId}' was not found`,
        ApplicationExceptionCode.NOT_FOUND,
      );
    }

    const row = rows[0];
    return {
      id: row.id,
      orderId: row.orderId,
      customerId: row.customerId,
      provider: row.provider,
      status: row.status,
      amount: row.amount,
      currency: row.currency,
      transactionId: row.transactionId,
      failureCode: row.failureCode,
      failureReason: row.failureReason,
      refundedAmount: row.refundedAmount,
      paidAt: row.paidAt,
      metadata: row.metadata,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }
}

