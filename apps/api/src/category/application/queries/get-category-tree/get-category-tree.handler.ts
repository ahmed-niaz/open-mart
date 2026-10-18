import { Inject } from '@nestjs/common';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { asc, eq } from 'drizzle-orm';
import { GetCategoryTreeQuery } from './get-category-tree.query.js';
import { CategoryTreeNodeDto } from '../../dto/category-tree-node.dto.js';
import { DRIZZLE } from '../../../../shared/infrastructure/database/postgres/drizzle.provider.js';
import type { DrizzleDB } from '../../../../shared/infrastructure/database/postgres/drizzle.provider.js';
import { categoriesSchema } from '../../../../shared/infrastructure/database/postgres/schema/category.schema.js';

@QueryHandler(GetCategoryTreeQuery)
export class GetCategoryTreeHandler implements IQueryHandler<
  GetCategoryTreeQuery,
  CategoryTreeNodeDto[]
> {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  async execute(query: GetCategoryTreeQuery): Promise<CategoryTreeNodeDto[]> {
    const rows = await this.db
      .select()
      .from(categoriesSchema)
      .where(
        query.includeInactive ? undefined : eq(categoriesSchema.isActive, true),
      )
      .orderBy(asc(categoriesSchema.displayOrder), asc(categoriesSchema.name));

    const map = new Map<string, CategoryTreeNodeDto>();
    const roots: CategoryTreeNodeDto[] = [];

    // First pass: instantiate all DTO nodes
    for (const row of rows) {
      map.set(row.id, {
        id: row.id,
        name: row.name,
        slug: row.slug,
        description: row.description,
        parentId: row.parentId,
        imageUrl: row.imageUrl ?? undefined,
        isActive: row.isActive,
        displayOrder: row.displayOrder,
        children: [],
      });
    }

    // Second pass: attach children to parents
    for (const row of rows) {
      const node = map.get(row.id)!;
      if (row.parentId && map.has(row.parentId)) {
        map.get(row.parentId)!.children.push(node);
      } else {
        roots.push(node);
      }
    }

    return roots;
  }
}
