import { Category } from '../../domain/entities/category.entity.js';
import { CategoryId } from '../../domain/value-objects/category-id.vo.js';
import { Slug } from '../../domain/value-objects/slug.vo.js';

export const CATEGORY_REPOSITORY = Symbol('CATEGORY_REPOSITORY');

export interface CategoryRepositoryPort {
  save(category: Category): Promise<void>;
  findById(id: CategoryId): Promise<Category | null>;
  findBySlug(slug: Slug): Promise<Category | null>;
  existsById(id: CategoryId): Promise<boolean>;
  existsBySlug(slug: Slug, excludeId?: CategoryId): Promise<boolean>;
  hasChildren(id: CategoryId): Promise<boolean>;
}
