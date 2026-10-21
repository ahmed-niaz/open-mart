import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';

import { AuthModule } from '../shared/infrastructure/auth/auth.module.js';
import { CustomerModule } from '../customer/customer.module.js';
import { CartController } from './presentation/cart.controller.js';
import { CART_REPOSITORY } from './application/ports/cart.repository.js';
import { DrizzleCartRepository } from './infrastructure/adapters/drizzle-cart.repository.js';
import { CART_PRODUCT_PORT } from './application/ports/cart-product.port.js';
import { CartProductAdapter } from './infrastructure/adapters/cart-product.adapter.js';
import { CART_INVENTORY_PORT } from './application/ports/cart-inventory.port.js';
import { CartInventoryAdapter } from './infrastructure/adapters/cart-inventory.adapter.js';
import { AddItemToCartCommandHandler } from './application/commands/add-item-to-cart/add-item-to-cart.handler.js';
import { UpdateCartItemQuantityCommandHandler } from './application/commands/update-cart-item-quantity/update-cart-item-quantity.handler.js';
import { RemoveItemFromCartCommandHandler } from './application/commands/remove-item-from-cart/remove-item-from-cart.handler.js';
import { ClearCartCommandHandler } from './application/commands/clear-cart/clear-cart.handler.js';
import { MergeCartCommandHandler } from './application/commands/merge-cart/merge-cart.handler.js';
import { GetCartQueryHandler } from './application/queries/get-cart/get-cart.handler.js';
import { AbandonedCartJob } from './infrastructure/jobs/abandoned-cart.job.js';
import { OptionalJwtAuthGuard } from '../shared/infrastructure/guards/optional-jwt-auth.guard.js';

@Module({
  imports: [CqrsModule, AuthModule, CustomerModule],
  controllers: [CartController],
  providers: [
    {
      provide: CART_REPOSITORY,
      useClass: DrizzleCartRepository,
    },
    {
      provide: CART_PRODUCT_PORT,
      useClass: CartProductAdapter,
    },
    {
      provide: CART_INVENTORY_PORT,
      useClass: CartInventoryAdapter,
    },
    AddItemToCartCommandHandler,
    UpdateCartItemQuantityCommandHandler,
    RemoveItemFromCartCommandHandler,
    ClearCartCommandHandler,
    MergeCartCommandHandler,
    GetCartQueryHandler,
    AbandonedCartJob,
    OptionalJwtAuthGuard,
  ],
  exports: [CART_REPOSITORY],
})
export class CartModule {}
