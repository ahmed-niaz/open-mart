import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { GetProductBySkuQuery } from './get-product-by-sku.query.js';
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

@QueryHandler(GetProductBySkuQuery)
export class GetProductBySkuHandler implements IQueryHandler<
  GetProductBySkuQuery,
  ProductResponseDto
> {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  async execute(query: GetProductBySkuQuery): Promise<ProductResponseDto> {
    const cleanSku = query.sku.trim();
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
      .where(eq(productsTable.sku, cleanSku))
      .limit(1);

    if (rows.length === 0) {
      throw new ApplicationException(
        `Product with SKU '${query.sku}' not found.`,
        ApplicationExceptionCode.NOT_FOUND,
      );
    }

    const { product, category } = rows[0];
    return ProductResponseDto.fromPersistence(
      product,
      category?.id ? category : null,
    );
  }
}
