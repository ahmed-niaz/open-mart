import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { ConfigModule } from '@nestjs/config';

import { AuthModule } from '../shared/infrastructure/auth/auth.module.js';
import { AdminModule } from '../admin/admin.module.js';
import { CustomerModule } from '../customer/customer.module.js';

import { DISCOUNT_REPOSITORY_PORT } from './application/ports/discount.repository.port.js';
import { DISCOUNT_REDEMPTION_REPOSITORY_PORT } from './application/ports/discount-redemption.repository.port.js';
import { DISCOUNT_CALCULATION_PORT } from '../order/application/ports/discount-calculation.port.js';

import { DrizzleDiscountRepository } from './infrastructure/adapters/drizzle-discount.repository.js';
import { DrizzleDiscountRedemptionRepository } from './infrastructure/adapters/drizzle-discount-redemption.repository.js';
import { DiscountCalculationAdapter } from './infrastructure/adapters/discount-calculation.adapter.js';

import { CreateDiscountCommandHandler } from './application/commands/create-discount/create-discount.handler.js';
import { UpdateDiscountCommandHandler } from './application/commands/update-discount/update-discount.handler.js';
import { ChangeDiscountStatusCommandHandler } from './application/commands/change-discount-status/change-discount-status.handler.js';

import { ValidateDiscountQueryHandler } from './application/queries/validate-discount/validate-discount.handler.js';
import { GetDiscountByIdQueryHandler } from './application/queries/get-discount-by-id/get-discount-by-id.handler.js';
import { ListDiscountsQueryHandler } from './application/queries/list-discounts/list-discounts.handler.js';
import { ListDiscountRedemptionsQueryHandler } from './application/queries/list-discount-redemptions/list-discount-redemptions.handler.js';

import { DiscountAdminController } from './presentation/controllers/discount-admin.controller.js';
import { DiscountCustomerController } from './presentation/controllers/discount-customer.controller.js';

import { OptionalJwtAuthGuard } from '../shared/infrastructure/guards/optional-jwt-auth.guard.js';
import { AdminJwtGuard } from '../shared/infrastructure/guards/admin-jwt.guard.js';
import { PermissionsGuard } from '../shared/infrastructure/guards/permissions.guard.js';

const CommandHandlers = [
  CreateDiscountCommandHandler,
  UpdateDiscountCommandHandler,
  ChangeDiscountStatusCommandHandler,
];

const QueryHandlers = [
  ValidateDiscountQueryHandler,
  GetDiscountByIdQueryHandler,
  ListDiscountsQueryHandler,
  ListDiscountRedemptionsQueryHandler,
];

@Module({
  imports: [CqrsModule, ConfigModule, AuthModule, AdminModule, CustomerModule],
  controllers: [DiscountAdminController, DiscountCustomerController],
  providers: [
    {
      provide: DISCOUNT_REPOSITORY_PORT,
      useClass: DrizzleDiscountRepository,
    },
    {
      provide: DISCOUNT_REDEMPTION_REPOSITORY_PORT,
      useClass: DrizzleDiscountRedemptionRepository,
    },
    {
      provide: DISCOUNT_CALCULATION_PORT,
      useClass: DiscountCalculationAdapter,
    },
    OptionalJwtAuthGuard,
    AdminJwtGuard,
    PermissionsGuard,
    ...CommandHandlers,
    ...QueryHandlers,
  ],
  exports: [
    DISCOUNT_REPOSITORY_PORT,
    DISCOUNT_REDEMPTION_REPOSITORY_PORT,
    DISCOUNT_CALCULATION_PORT,
  ],
})
export class DiscountModule {}
