import { Inject } from '@nestjs/common';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { and, asc, count, desc, eq, ilike, isNull, or, SQL } from 'drizzle-orm';
import { ListCategoriesQuery } from './list-categories.query.js';
import { CategoryResponseDto } from '../../dto/category-response.dto.js';
import { PaginatedResult } from '../../../../shared/application/pagination/paginated-result.js';
import { DRIZZLE } from '../../../../shared/infrastructure/database/postgres/drizzle.provider.js';
import type { DrizzleDB } from '../../../../shared/infrastructure/database/postgres/drizzle.provider.js';
import { categoriesSchema } from '../../../../shared/infrastructure/database/postgres/schema/category.schema.js';

@QueryHandler(ListCategoriesQuery)
export class ListCategoriesHandler implements IQueryHandler<
  ListCategoriesQuery,
  PaginatedResult<CategoryResponseDto>
> {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  async execute(
    query: ListCategoriesQuery,
  ): Promise<PaginatedResult<CategoryResponseDto>> {
    const page = Math.max(1, query.page);
    const limit = Math.max(1, Math.min(query.limit, 100));
    const offset = (page - 1) * limit;

    const conditions: SQL[] = [];

    if (query.search && query.search.trim().length > 0) {
      const searchPattern = `%${query.search.trim()}%`;
      conditions.push(
        or(
          ilike(categoriesSchema.name, searchPattern),
          ilike(categoriesSchema.slug, searchPattern),
          ilike(categoriesSchema.description, searchPattern),
        )!,
      );
    }

    if (query.isActive !== undefined) {
      conditions.push(eq(categoriesSchema.isActive, query.isActive));
    }

    if (query.parentId !== undefined) {
      if (query.parentId === null) {
        conditions.push(isNull(categoriesSchema.parentId));
      } else {
        conditions.push(eq(categoriesSchema.parentId, query.parentId));
      }
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const [totalResult] = await this.db
      .select({ value: count() })
      .from(categoriesSchema)
      .where(whereClause);

    const total = totalResult?.value ? Number(totalResult.value) : 0;

    const rows = await this.db
      .select()
      .from(categoriesSchema)
      .where(whereClause)
      .orderBy(
        asc(categoriesSchema.displayOrder),
        desc(categoriesSchema.createdAt),
      )
      .limit(limit)
      .offset(offset);

    const items: CategoryResponseDto[] = rows.map((row) => ({
      id: row.id,
      name: row.name,
      slug: row.slug,
      description: row.description,
      parentId: row.parentId,
      imageUrl: row.imageUrl ?? undefined,
      isActive: row.isActive,
      displayOrder: row.displayOrder,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    }));

    return PaginatedResult.create<CategoryResponseDto>(
      items,
      total,
      page,
      limit,
    );
  }
}
