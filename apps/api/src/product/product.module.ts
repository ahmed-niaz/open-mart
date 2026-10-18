import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { ProductController } from './presentation/product.controller.js';
import { PRODUCT_REPOSITORY } from './application/ports/product.repository.js';
import { DrizzleProductRepository } from './infrastructure/adapters/drizzle-product.repository.js';
import { ProductCommandHandlers } from './application/use-cases/index.js';
import { ProductQueryHandlers } from './application/queries/index.js';

import { CATEGORY_VERIFICATION_PORT } from './application/ports/category-verification.port.js';
import { CategoryVerificationAdapter } from './infrastructure/adapters/category-verification.adapter.js';

@Module({
  imports: [CqrsModule],
  controllers: [ProductController],
  providers: [
    {
      provide: PRODUCT_REPOSITORY,
      useClass: DrizzleProductRepository,
    },
    {
      provide: CATEGORY_VERIFICATION_PORT,
      useClass: CategoryVerificationAdapter,
    },
    ...ProductCommandHandlers,
    ...ProductQueryHandlers,
  ],
  exports: [PRODUCT_REPOSITORY],
})
export class ProductModule {}
