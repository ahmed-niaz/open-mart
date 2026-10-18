import { Inject, Injectable } from '@nestjs/common';
import { and, eq, ne } from 'drizzle-orm';
import { CategoryRepositoryPort } from '../../application/ports/category.repository.js';
import { Category } from '../../domain/entities/category.entity.js';
import { CategoryId } from '../../domain/value-objects/category-id.vo.js';
import { Slug } from '../../domain/value-objects/slug.vo.js';
import {
  ApplicationException,
  ApplicationExceptionCode,
} from '../../../shared/domain/exceptions/application.exception.js';
import { DRIZZLE } from '../../../shared/infrastructure/database/postgres/drizzle.provider.js';
import type { DrizzleDB } from '../../../shared/infrastructure/database/postgres/drizzle.provider.js';
import {
  categoriesSchema,
  CategoryInsertRow,
  CategorySelectRow,
} from '../../../shared/infrastructure/database/postgres/schema/category.schema.js';

@Injectable()
export class DrizzleCategoryRepository implements CategoryRepositoryPort {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  async save(category: Category): Promise<void> {
    const row = DrizzleCategoryRepository.toPersistence(category);

    const existingRows = await this.db
      .select({ id: categoriesSchema.id, version: categoriesSchema.version })
      .from(categoriesSchema)
      .where(eq(categoriesSchema.id, category.id.getValue()))
      .limit(1);

    if (existingRows.length === 0) {
      await this.db.insert(categoriesSchema).values(row);
      return;
    }

    const currentVersion = category.version;
    const nextVersion = currentVersion + 1;

    const updated = await this.db
      .update(categoriesSchema)
      .set({
        name: row.name,
        slug: row.slug,
        description: row.description,
        parentId: row.parentId,
        imageUrl: row.imageUrl,
        isActive: row.isActive,
        displayOrder: row.displayOrder,
        version: nextVersion,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(categoriesSchema.id, category.id.getValue()),
          eq(categoriesSchema.version, currentVersion),
        ),
      )
      .returning({ id: categoriesSchema.id });

    if (updated.length === 0) {
      throw new ApplicationException(
        `Optimistic lock failure: Category '${category.id.getValue()}' was modified by another process.`,
        ApplicationExceptionCode.CONFLICT,
      );
    }

    category.incrementVersion();
  }

  async findById(id: CategoryId): Promise<Category | null> {
    const rows = await this.db
      .select()
      .from(categoriesSchema)
      .where(eq(categoriesSchema.id, id.getValue()))
      .limit(1);

    if (!rows[0]) return null;
    return DrizzleCategoryRepository.toDomain(rows[0]);
  }

  async findBySlug(slug: Slug): Promise<Category | null> {
    const rows = await this.db
      .select()
      .from(categoriesSchema)
      .where(eq(categoriesSchema.slug, slug.getValue()))
      .limit(1);

    if (!rows[0]) return null;
    return DrizzleCategoryRepository.toDomain(rows[0]);
  }

  async existsById(id: CategoryId): Promise<boolean> {
    const rows = await this.db
      .select({ id: categoriesSchema.id })
      .from(categoriesSchema)
      .where(eq(categoriesSchema.id, id.getValue()))
      .limit(1);

    return rows.length > 0;
  }

  async existsBySlug(slug: Slug, excludeId?: CategoryId): Promise<boolean> {
    const condition = excludeId
      ? and(
          eq(categoriesSchema.slug, slug.getValue()),
          ne(categoriesSchema.id, excludeId.getValue()),
        )
      : eq(categoriesSchema.slug, slug.getValue());

    const rows = await this.db
      .select({ id: categoriesSchema.id })
      .from(categoriesSchema)
      .where(condition)
      .limit(1);

    return rows.length > 0;
  }

  async hasChildren(id: CategoryId): Promise<boolean> {
    const rows = await this.db
      .select({ id: categoriesSchema.id })
      .from(categoriesSchema)
      .where(eq(categoriesSchema.parentId, id.getValue()))
      .limit(1);

    return rows.length > 0;
  }

  // --- Mappers ---

  public static toPersistence(category: Category): CategoryInsertRow {
    return {
      id: category.id.getValue(),
      name: category.name,
      slug: category.slug.getValue(),
      description: category.description,
      parentId: category.parentId ? category.parentId.getValue() : null,
      imageUrl: category.imageUrl ?? null,
      isActive: category.isActive,
      displayOrder: category.displayOrder,
      version: category.version,
      createdAt: category.createdAt,
      updatedAt: category.updatedAt,
    };
  }

  public static toDomain(row: CategorySelectRow): Category {
    return Category.reconstitute({
      id: new CategoryId(row.id),
      name: row.name,
      slug: Slug.fromPersisted(row.slug),
      description: row.description,
      parentId: row.parentId ? new CategoryId(row.parentId) : null,
      imageUrl: row.imageUrl ?? undefined,
      isActive: row.isActive,
      displayOrder: row.displayOrder,
      version: row.version,
      createdAt: new Date(row.createdAt),
      updatedAt: new Date(row.updatedAt),
    });
  }
}
