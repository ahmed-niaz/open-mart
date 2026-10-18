import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { ConfigModule } from '@nestjs/config';
import { DrizzleModule } from './shared/infrastructure/database/postgres/drizzle.module.js';
import { StorageModule } from './shared/infrastructure/storage/storage.module.js';
import { ProductModule } from './product/product.module.js';
import { CategoryModule } from './category/category.module.js';
import { NotificationModule } from './notification/notification.module.js';
import { CustomerModule } from './customer/customer.module.js';

@Module({
  imports: [
    CqrsModule.forRoot(),

    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env.local', '.env'],
    }),
    DrizzleModule,
    StorageModule,
    ProductModule,
    CategoryModule,
    NotificationModule,
    CustomerModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
