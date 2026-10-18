import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { CategoryController } from './presentation/category.controller.js';
import { CATEGORY_REPOSITORY } from './application/ports/category.repository.js';
import { DrizzleCategoryRepository } from './infrastructure/adapters/drizzle-category.repository.js';
import { CategoryCommandHandlers } from './application/use-cases/index.js';
import { CategoryQueryHandlers } from './application/queries/index.js';

@Module({
  imports: [CqrsModule],
  controllers: [CategoryController],
  providers: [
    {
      provide: CATEGORY_REPOSITORY,
      useClass: DrizzleCategoryRepository,
    },
    ...CategoryCommandHandlers,
    ...CategoryQueryHandlers,
  ],
})
export class CategoryModule {}
