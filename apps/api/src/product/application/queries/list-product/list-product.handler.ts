import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { and, count, desc, eq, gte, ilike, lte, or } from 'drizzle-orm';
import {
  DRIZZLE,
  type DrizzleDB,
} from '../../../../shared/infrastructure/database/postgres/drizzle.provider.js';
import { productsTable } from '../../../../shared/infrastructure/database/postgres/schema/product.schema.js';
import { categoriesSchema } from '../../../../shared/infrastructure/database/postgres/schema/category.schema.js';
import { PaginatedResult } from '../../../../shared/application/pagination/paginated-result.js';
import { ProductResponseDto } from '../../dto/product-response.dto.js';
import { ListProductQuery } from './list-product.query.js';

@QueryHandler(ListProductQuery)
export class ListProductHandler implements IQueryHandler<
  ListProductQuery,
  PaginatedResult<ProductResponseDto>
> {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  async execute(
    query: ListProductQuery,
  ): Promise<PaginatedResult<ProductResponseDto>> {
    const conditions = [];

    // 1. Status Filter (defaults to 'active' for catalog queries)
    if (query.status !== undefined && query.status.trim() !== '') {
      if (query.status.toLowerCase() !== 'all') {
        conditions.push(eq(productsTable.status, query.status.toLowerCase()));
      }
    } else if (query.isActive !== undefined) {
      conditions.push(
        eq(productsTable.status, query.isActive ? 'active' : 'draft'),
      );
    } else {
      conditions.push(eq(productsTable.status, 'active'));
    }

    // 2. Keyword Search across Title, SKU, and Description
    if (query.search !== undefined && query.search.trim() !== '') {
      const searchTerm = `%${query.search.trim()}%`;
      conditions.push(
        or(
          ilike(productsTable.title, searchTerm),
          ilike(productsTable.sku, searchTerm),
          ilike(productsTable.description, searchTerm),
        ),
      );
    }

    // 3. Price Range Filters
    if (query.minPrice !== undefined) {
      conditions.push(gte(productsTable.unitPriceAmount, query.minPrice));
    }

    if (query.maxPrice !== undefined) {
      conditions.push(lte(productsTable.unitPriceAmount, query.maxPrice));
    }

    // 4. Category Filter (supports slug, UUID categoryId, or category name)
    if (query.category !== undefined && query.category.trim() !== '') {
      const catTrimmed = query.category.trim();
      const catLower = catTrimmed.toLowerCase();
      const isUuid =
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
          catTrimmed,
        );

      const categoryFilterConditions = [
        eq(categoriesSchema.slug, catLower),
        ilike(categoriesSchema.name, catTrimmed),
      ];

      if (isUuid) {
        categoryFilterConditions.push(eq(productsTable.categoryId, catTrimmed));
      }

      conditions.push(or(...categoryFilterConditions));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    // 5. Total Count Query
    const [countResult] = await this.db
      .select({ total: count() })
      .from(productsTable)
      .leftJoin(
        categoriesSchema,
        eq(productsTable.categoryId, categoriesSchema.id),
      )
      .where(whereClause);

    const total = Number(countResult?.total ?? 0);

    // 6. Paginated Rows Query with joined Category summary
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
      .where(whereClause)
      .orderBy(desc(productsTable.createdAt))
      .limit(query.limit)
      .offset(query.offset);

    const dtos = rows.map(({ product, category }) =>
      ProductResponseDto.fromPersistence(
        product,
        category?.id ? category : null,
      ),
    );

    return PaginatedResult.create(dtos, total, query.page, query.limit);
  }
}
