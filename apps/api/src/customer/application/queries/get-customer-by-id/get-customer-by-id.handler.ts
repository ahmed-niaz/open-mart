import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { eq } from 'drizzle-orm';

import { GetCustomerByIdQuery } from './get-customer-by-id.query.js';
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

@QueryHandler(GetCustomerByIdQuery)
export class GetCustomerByIdHandler implements IQueryHandler<
  GetCustomerByIdQuery,
  CustomerResponseDto
> {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  async execute(query: GetCustomerByIdQuery): Promise<CustomerResponseDto> {
    const rows = await this.db
      .select()
      .from(customersSchema)
      .where(eq(customersSchema.id, query.id))
      .limit(1);

    const row = rows[0];
    if (!row) {
      throw new ApplicationException(
        `Customer with id '${query.id}' not found`,
        ApplicationExceptionCode.NOT_FOUND,
      );
    }

    return CustomerResponseDto.fromPersistence(row);
  }
}
