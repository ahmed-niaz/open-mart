import { CreateCategoryHandler } from './create-category/create-category.handler.js';
import { UpdateCategoryHandler } from './update-category/update-category.handler.js';
import { ActivateCategoryHandler } from './activate-category/activate-category.handler.js';
import { DeactivateCategoryHandler } from './deactivate-category/deactivate-category.handler.js';

export * from './create-category/create-category.command.js';
export * from './create-category/create-category.handler.js';
export * from './update-category/update-category.command.js';
export * from './update-category/update-category.handler.js';
export * from './activate-category/activate-category.command.js';
export * from './activate-category/activate-category.handler.js';
export * from './deactivate-category/deactivate-category.command.js';
export * from './deactivate-category/deactivate-category.handler.js';

export const CategoryCommandHandlers = [
  CreateCategoryHandler,
  UpdateCategoryHandler,
  ActivateCategoryHandler,
  DeactivateCategoryHandler,
];
