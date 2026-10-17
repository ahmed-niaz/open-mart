import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { and, eq, gte, lte } from 'drizzle-orm';
import {
  DRIZZLE,
  type DrizzleDB,
} from '../../../../shared/infrastructure/database/postgres/drizzle.provider.js';
import { productsTable } from '../../../../shared/infrastructure/database/postgres/schema/product.schema.js';
import { ProductResponseDto } from '../../../presentation/dto/product-response.dto.js';
import { ListProductQuery } from './list-product.query.js';

@QueryHandler(ListProductQuery)
export class ListProductHandler implements IQueryHandler<
  ListProductQuery,
  ProductResponseDto[]
> {
  constructor(
    @Inject(DRIZZLE)
    private readonly db: DrizzleDB,
  ) {}

  async execute(query: ListProductQuery): Promise<ProductResponseDto[]> {
    const conditions = [];

    if (query.status !== undefined) {
      conditions.push(eq(productsTable.status, query.status));
    } else if (query.isActive !== undefined) {
      conditions.push(
        eq(productsTable.status, query.isActive ? 'active' : 'draft'),
      );
    }

    if (query.minPrice !== undefined) {
      conditions.push(gte(productsTable.unitPriceAmount, query.minPrice));
    }

    if (query.maxPrice !== undefined) {
      conditions.push(lte(productsTable.unitPriceAmount, query.maxPrice));
    }

    const rows = await this.db
      .select()
      .from(productsTable)
      .where(conditions.length > 0 ? and(...conditions) : undefined);

    let filteredRows = rows;
    if (query.category) {
      const catLower = query.category.toLowerCase();
      filteredRows = rows.filter(
        (r) => r.category?.name?.toLowerCase() === catLower,
      );
    }

    return filteredRows.map((row) => ProductResponseDto.fromPersistence(row));
  }
}
