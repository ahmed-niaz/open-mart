import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { ProductController } from './presentation/product.controller.js';
import { PRODUCT_REPOSITORY } from './application/ports/product.repository.js';
import { DrizzleProductRepository } from './infrastructure/adapters/drizzle-product.repository.js';
import { ProductCommandHandlers } from './application/use-cases/index.js';
import { ProductQueryHandlers } from './application/queries/index.js';

import { CATEGORY_VERIFICATION_PORT } from './application/ports/category-verification.port.js';
import { CategoryVerificationAdapter } from './infrastructure/adapters/category-verification.adapter.js';
import { PRODUCT_MEDIA_SYNC_PORT } from './application/ports/product-media-sync.port.js';
import { DrizzleProductMediaSyncAdapter } from './infrastructure/adapters/drizzle-product-media-sync.adapter.js';
import { StorageModule } from '../shared/infrastructure/storage/storage.module.js';

@Module({
  imports: [CqrsModule, StorageModule],
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
    {
      provide: PRODUCT_MEDIA_SYNC_PORT,
      useClass: DrizzleProductMediaSyncAdapter,
    },
    ...ProductCommandHandlers,
    ...ProductQueryHandlers,
  ],
  exports: [PRODUCT_REPOSITORY, PRODUCT_MEDIA_SYNC_PORT],
})
export class ProductModule {}
