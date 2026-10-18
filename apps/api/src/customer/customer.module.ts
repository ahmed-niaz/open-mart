import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';

import { CustomerController } from './presentation/customer.controller.js';
import { GoogleAuthController } from './presentation/google-auth.controller.js';
import { CUSTOMER_REPOSITORY } from './application/ports/customer.repository.js';
import { DrizzleCustomerRepository } from './infrastructure/adapters/drizzle-customer.repository.js';
import { PASSWORD_HASHER_PORT } from './application/ports/password-hasher.port.js';
import { BcryptPasswordHasherAdapter } from './infrastructure/adapters/bcrypt-password-hasher.adapter.js';
import { GOOGLE_AUTH_PORT } from './application/ports/google-auth.port.js';
import { GoogleAuthAdapter } from './infrastructure/adapters/google-auth.adapter.js';
import { CustomerCommandHandlers } from './application/use-cases/index.js';
import { CustomerQueryHandlers } from './application/queries/index.js';
import { JwtAuthGuard } from './presentation/guards/jwt-auth.guard.js';

@Module({
  imports: [
    CqrsModule,
    ConfigModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        secret:
          configService.get<string>('JWT_ACCESS_SECRET') ??
          configService.get<string>(
            'JWT_SECRET',
            'open-mart-customer-jwt-secret-key-2026-secure-fallback',
          ),
        signOptions: {
          expiresIn: (configService.get<string>('JWT_ACCESS_EXPIRES') ??
            configService.get<string>('JWT_EXPIRES_IN', '1d') ??
            '1d') as any,
        },
      }),
      inject: [ConfigService],
    }),
  ],
  controllers: [CustomerController, GoogleAuthController],
  providers: [
    {
      provide: CUSTOMER_REPOSITORY,
      useClass: DrizzleCustomerRepository,
    },
    {
      provide: PASSWORD_HASHER_PORT,
      useClass: BcryptPasswordHasherAdapter,
    },
    {
      provide: GOOGLE_AUTH_PORT,
      useClass: GoogleAuthAdapter,
    },
    ...CustomerCommandHandlers,
    ...CustomerQueryHandlers,
    JwtAuthGuard,
  ],
  exports: [JwtAuthGuard, JwtModule],
})
export class CustomerModule {}
