import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { ConfigModule } from '@nestjs/config';
import { DrizzleModule } from './shared/infrastructure/database/postgres/drizzle.module.js';
import { ProductModule } from './product/product.module.js';

@Module({
  imports: [
    CqrsModule.forRoot(),

    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env.local', '.env'],
    }),
    DrizzleModule,
    ProductModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
