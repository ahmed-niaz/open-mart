import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { ConfigModule } from '@nestjs/config';

import { AuthModule } from '../shared/infrastructure/auth/auth.module.js';
import { CustomerModule } from '../customer/customer.module.js';
import { OrderController } from './presentation/order.controller.js';
import { ORDER_REPOSITORY } from './application/ports/order.repository.js';
import { DrizzleOrderRepository } from './infrastructure/adapters/drizzle-order.repository.js';
import { PRODUCT_VERIFICATION_PORT } from './application/ports/product-verification.port.js';
import { ProductVerificationAdapter } from './infrastructure/adapters/product-verification.adapter.js';
import { OrderCommandHandlers } from './application/use-cases/index.js';
import { OrderQueryHandlers } from './application/queries/index.js';
import { OptionalJwtAuthGuard } from '../shared/infrastructure/guards/optional-jwt-auth.guard.js';
import { AdminGuard } from '../shared/infrastructure/guards/admin.guard.js';

@Module({
  imports: [CqrsModule, ConfigModule, AuthModule, CustomerModule],
  controllers: [OrderController],
  providers: [
    {
      provide: ORDER_REPOSITORY,
      useClass: DrizzleOrderRepository,
    },
    {
      provide: PRODUCT_VERIFICATION_PORT,
      useClass: ProductVerificationAdapter,
    },
    OptionalJwtAuthGuard,
    AdminGuard,
    ...OrderCommandHandlers,
    ...OrderQueryHandlers,
  ],
  exports: [ORDER_REPOSITORY],
})
export class OrderModule {}
