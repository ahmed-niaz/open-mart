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
import { CacheService } from '../../../../shared/infrastructure/cache/cache.service.js';

@QueryHandler(ListProductQuery)
export class ListProductHandler implements IQueryHandler<
  ListProductQuery,
  PaginatedResult<ProductResponseDto>
> {
  constructor(
    @Inject(DRIZZLE) private readonly db: DrizzleDB,
    private readonly cacheService: CacheService,
  ) {}

  async execute(
    query: ListProductQuery,
  ): Promise<PaginatedResult<ProductResponseDto>> {
    const page = Math.max(1, query.page ?? 1);
    const limit = Math.max(1, Math.min(query.limit ?? 20, 100));
    const status =
      query.status !== undefined && query.status.trim() !== ''
        ? query.status.toLowerCase()
        : query.isActive !== undefined
          ? query.isActive
            ? 'active'
            : 'draft'
          : 'active';
    const search = query.search?.trim().toLowerCase() ?? '';
    const category = query.category?.trim().toLowerCase() ?? '';
    const minPrice = query.minPrice ?? null;
    const maxPrice = query.maxPrice ?? null;

    const cacheKey = `product:list:${JSON.stringify({
      page,
      limit,
      status,
      search,
      category,
      minPrice,
      maxPrice,
    })}`;

    return this.cacheService.getOrSet(
      cacheKey,
      async () => {
        const conditions = [];

        // 1. Status Filter
        if (status !== 'all') {
          conditions.push(eq(productsTable.status, status));
        }

        // 2. Keyword Search across Title, SKU, and Description
        if (search.length > 0) {
          const searchTerm = `%${search}%`;
          conditions.push(
            or(
              ilike(productsTable.title, searchTerm),
              ilike(productsTable.sku, searchTerm),
              ilike(productsTable.description, searchTerm),
            ),
          );
        }

        // 3. Price Range Filters
        if (minPrice !== null) {
          conditions.push(gte(productsTable.unitPriceAmount, minPrice));
        }

        if (maxPrice !== null) {
          conditions.push(lte(productsTable.unitPriceAmount, maxPrice));
        }

        // 4. Category Filter (supports slug, UUID categoryId, or category name)
        if (category.length > 0) {
          const isUuid =
            /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
              category,
            );

          const categoryFilterConditions = [
            eq(categoriesSchema.slug, category),
            ilike(categoriesSchema.name, category),
          ];

          if (isUuid) {
            categoryFilterConditions.push(
              eq(productsTable.categoryId, category),
            );
          }

          conditions.push(or(...categoryFilterConditions));
        }

        const whereClause =
          conditions.length > 0 ? and(...conditions) : undefined;

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
          .limit(limit)
          .offset((page - 1) * limit);

        const dtos = rows.map(({ product, category: cat }) =>
          ProductResponseDto.fromPersistence(product, cat?.id ? cat : null),
        );

        return PaginatedResult.create(dtos, total, page, limit);
      },
      60, // 60-second TTL with single-flight stampede protection
    );
  }
}
