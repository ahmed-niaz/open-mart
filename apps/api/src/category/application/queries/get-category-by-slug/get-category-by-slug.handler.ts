import { Inject } from '@nestjs/common';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { eq } from 'drizzle-orm';
import { GetCategoryBySlugQuery } from './get-category-by-slug.query.js';
import { CategoryResponseDto } from '../../dto/category-response.dto.js';
import {
  ApplicationException,
  ApplicationExceptionCode,
} from '../../../../shared/domain/exceptions/application.exception.js';
import { DRIZZLE } from '../../../../shared/infrastructure/database/postgres/drizzle.provider.js';
import type { DrizzleDB } from '../../../../shared/infrastructure/database/postgres/drizzle.provider.js';
import { categoriesSchema } from '../../../../shared/infrastructure/database/postgres/schema/category.schema.js';

@QueryHandler(GetCategoryBySlugQuery)
export class GetCategoryBySlugHandler implements IQueryHandler<
  GetCategoryBySlugQuery,
  CategoryResponseDto
> {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  async execute(query: GetCategoryBySlugQuery): Promise<CategoryResponseDto> {
    const rows = await this.db
      .select()
      .from(categoriesSchema)
      .where(eq(categoriesSchema.slug, query.slug.trim().toLowerCase()))
      .limit(1);

    if (!rows[0]) {
      throw new ApplicationException(
        `Category with slug '${query.slug}' not found.`,
        ApplicationExceptionCode.NOT_FOUND,
      );
    }

    const row = rows[0];
    return {
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
    };
  }
}
