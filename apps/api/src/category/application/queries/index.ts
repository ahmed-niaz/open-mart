import { GetCategoryTreeHandler } from './get-category-tree/get-category-tree.handler.js';
import { GetCategoryByIdHandler } from './get-category-by-id/get-category-by-id.handler.js';
import { GetCategoryBySlugHandler } from './get-category-by-slug/get-category-by-slug.handler.js';
import { ListCategoriesHandler } from './list-categories/list-categories.handler.js';

export const CategoryQueryHandlers = [
  GetCategoryTreeHandler,
  GetCategoryByIdHandler,
  GetCategoryBySlugHandler,
  ListCategoriesHandler,
];
