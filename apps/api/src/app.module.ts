import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { CqrsModule } from '@nestjs/cqrs';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { ScheduleModule } from '@nestjs/schedule';
import { DrizzleModule } from './shared/infrastructure/database/postgres/drizzle.module.js';
import { StorageModule } from './shared/infrastructure/storage/storage.module.js';
import { AuthModule } from './shared/infrastructure/auth/auth.module.js';
import { ProductModule } from './product/product.module.js';
import { CategoryModule } from './category/category.module.js';
import { NotificationModule } from './notification/notification.module.js';
import { CustomerModule } from './customer/customer.module.js';
import { OrderModule } from './order/order.module.js';
import { PaymentModule } from './payment/payment.module.js';
import { InventoryModule } from './inventory/inventory.module.js';
import { AdminModule } from './admin/admin.module.js';

@Module({
  imports: [
    CqrsModule.forRoot(),
    ScheduleModule.forRoot(),

    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env.local', '.env'],
    }),

    ThrottlerModule.forRoot([
      {
        ttl: 60000,
        limit: 100,
      },
    ]),

    DrizzleModule,
    StorageModule,
    AuthModule,
    ProductModule,
    CategoryModule,
    NotificationModule,
    CustomerModule,
    OrderModule,
    PaymentModule,
    InventoryModule,
    AdminModule,
  ],
  controllers: [],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
