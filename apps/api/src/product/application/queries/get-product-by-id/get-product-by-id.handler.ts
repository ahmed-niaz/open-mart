import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { GetProductByIdQuery } from './get-product-by-id.query.js';
import {
  DRIZZLE,
  type DrizzleDB,
} from '../../../../shared/infrastructure/database/postgres/drizzle.provider.js';
import { productsTable } from '../../../../shared/infrastructure/database/postgres/schema/product.schema.js';
import { categoriesSchema } from '../../../../shared/infrastructure/database/postgres/schema/category.schema.js';
import { ProductResponseDto } from '../../dto/product-response.dto.js';
import {
  ApplicationException,
  ApplicationExceptionCode,
} from '../../../../shared/domain/exceptions/application.exception.js';
import { CacheService } from '../../../../shared/infrastructure/cache/cache.service.js';

@QueryHandler(GetProductByIdQuery)
export class GetProductByIdHandler implements IQueryHandler<
  GetProductByIdQuery,
  ProductResponseDto
> {
  constructor(
    @Inject(DRIZZLE) private readonly db: DrizzleDB,
    private readonly cacheService: CacheService,
  ) {}

  async execute(query: GetProductByIdQuery): Promise<ProductResponseDto> {
    return this.cacheService.getOrSet(
      `product:id:${query.id}`,
      async () => {
        const rows = await this.db
          .select({
            product: productsTable,
            category: {
              id: categoriesSchema.id,
              name: categoriesSchema.name,
              slug: categoriesSchema.slug,
            },
          })
          .from(productsTable)
          .leftJoin(
            categoriesSchema,
            eq(productsTable.categoryId, categoriesSchema.id),
          )
          .where(eq(productsTable.id, query.id))
          .limit(1);

        if (rows.length === 0) {
          throw new ApplicationException(
            `Product with id '${query.id}' not found.`,
            ApplicationExceptionCode.NOT_FOUND,
          );
        }

        const { product, category } = rows[0];
        return ProductResponseDto.fromPersistence(
          product,
          category?.id ? category : null,
        );
      },
      180, // 3-minute TTL
    );
  }
}
