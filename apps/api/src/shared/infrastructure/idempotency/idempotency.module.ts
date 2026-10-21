import { Global, Module } from '@nestjs/common';
import { IdempotencyService } from './idempotency.service.js';
import { IdempotencyInterceptor } from './idempotency.interceptor.js';
import { DrizzleModule } from '../database/postgres/drizzle.module.js';

@Global()
@Module({
  imports: [DrizzleModule],
  providers: [IdempotencyService, IdempotencyInterceptor],
  exports: [IdempotencyService, IdempotencyInterceptor],
})
export class IdempotencyModule {}
