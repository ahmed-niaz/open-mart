import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { eq } from 'drizzle-orm';

import { GetCustomerByEmailQuery } from './get-customer-by-email.query.js';
import {
  DRIZZLE,
  type DrizzleDB,
} from '../../../../shared/infrastructure/database/postgres/drizzle.provider.js';
import { customersSchema } from '../../../../shared/infrastructure/database/postgres/schema/customer.schema.js';
import { CustomerResponseDto } from '../../dto/customer-response.dto.js';
import {
  ApplicationException,
  ApplicationExceptionCode,
} from '../../../../shared/domain/exceptions/application.exception.js';

@QueryHandler(GetCustomerByEmailQuery)
export class GetCustomerByEmailHandler implements IQueryHandler<
  GetCustomerByEmailQuery,
  CustomerResponseDto
> {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  async execute(query: GetCustomerByEmailQuery): Promise<CustomerResponseDto> {
    const normalized = query.email.trim().toLowerCase();
    const rows = await this.db
      .select()
      .from(customersSchema)
      .where(eq(customersSchema.email, normalized))
      .limit(1);

    const row = rows[0];
    if (!row) {
      throw new ApplicationException(
        `Customer with email '${query.email}' not found`,
        ApplicationExceptionCode.NOT_FOUND,
      );
    }

    return CustomerResponseDto.fromPersistence(row);
  }
}
