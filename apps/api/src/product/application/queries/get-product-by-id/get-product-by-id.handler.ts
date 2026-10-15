import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { GetProductByIdQuery } from './get-product-by-id.query.js';
import {
  DRIZZLE,
  type DrizzleDB,
} from '../../../../shared/infrastructure/database/postgres/drizzle.provider.js';
import { productsTable } from '../../../../shared/infrastructure/database/postgres/schema/product.schema.js';
import { ProductResponseDto } from '../../../presentation/dto/product-response.dto.js';
import {
  ApplicationException,
  ApplicationExceptionCode,
} from '../../../../shared/domain/exceptions/application.exception.js';

@QueryHandler(GetProductByIdQuery)
export class GetProductByIdHandler implements IQueryHandler<
  GetProductByIdQuery,
  ProductResponseDto
> {
  constructor(
    @Inject(DRIZZLE)
    private readonly db: DrizzleDB,
  ) {}

  async execute(query: GetProductByIdQuery): Promise<ProductResponseDto> {
    const rows = await this.db
      .select()
      .from(productsTable)
      .where(eq(productsTable.id, query.id))
      .limit(1);

    if (rows.length === 0) {
      throw new ApplicationException(
        `Product with id '${query.id}' not found.`,
        ApplicationExceptionCode.NOT_FOUND,
      );
    }

    return ProductResponseDto.fromPersistence(rows[0]);
  }
}
