import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { ConfigModule } from '@nestjs/config';

import { AuthModule } from '../shared/infrastructure/auth/auth.module.js';
import { CustomerController } from './presentation/customer.controller.js';
import { GoogleAuthController } from './presentation/google-auth.controller.js';
import { CUSTOMER_REPOSITORY } from './application/ports/customer.repository.js';
import { DrizzleCustomerRepository } from './infrastructure/adapters/drizzle-customer.repository.js';
import { GOOGLE_AUTH_PORT } from './application/ports/google-auth.port.js';
import { GoogleAuthAdapter } from './infrastructure/adapters/google-auth.adapter.js';
import { CustomerCommandHandlers } from './application/use-cases/index.js';
import { CustomerQueryHandlers } from './application/queries/index.js';
import { JwtAuthGuard } from './presentation/guards/jwt-auth.guard.js';

@Module({
  imports: [CqrsModule, ConfigModule, AuthModule],
  controllers: [CustomerController, GoogleAuthController],
  providers: [
    {
      provide: CUSTOMER_REPOSITORY,
      useClass: DrizzleCustomerRepository,
    },
    {
      provide: GOOGLE_AUTH_PORT,
      useClass: GoogleAuthAdapter,
    },
    ...CustomerCommandHandlers,
    ...CustomerQueryHandlers,
    JwtAuthGuard,
  ],
  exports: [JwtAuthGuard],
})
export class CustomerModule {}
