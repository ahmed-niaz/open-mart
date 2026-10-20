import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { ConfigModule, ConfigService } from '@nestjs/config';

import { NOTIFICATION_PORT } from './application/ports/notification.port.js';
import { NodemailerNotificationAdapter } from './infrastructure/adapters/nodemailer-notification.adapter.js';
import { ConsoleNotificationAdapter } from './infrastructure/adapters/console-notification.adapter.js';
import { CustomerRegisteredEventHandler } from './application/event-handlers/customer-registered.event-handler.js';
import { OrderPlacedEventHandler } from './application/event-handlers/order-placed.event-handler.js';
import { OrderShippedEventHandler } from './application/event-handlers/order-shipped.event-handler.js';
import { PaymentCompletedNotificationHandler } from './application/event-handlers/payment-completed.event-handler.js';
import { PaymentFailedNotificationHandler } from './application/event-handlers/payment-failed.event-handler.js';
import { PaymentCancelledNotificationHandler } from './application/event-handlers/payment-cancelled.event-handler.js';

@Module({
  imports: [CqrsModule, ConfigModule],
  providers: [
    {
      provide: NOTIFICATION_PORT,
      useFactory: (configService: ConfigService) => {
        const smtpUser = configService.get<string>('SMTP_USER');
        const smtpPass = configService.get<string>('SMTP_PASS');

        if (smtpUser && smtpPass) {
          return new NodemailerNotificationAdapter(configService);
        }
        return new ConsoleNotificationAdapter();
      },
      inject: [ConfigService],
    },
    CustomerRegisteredEventHandler,
    OrderPlacedEventHandler,
    OrderShippedEventHandler,
    PaymentCompletedNotificationHandler,
    PaymentFailedNotificationHandler,
    PaymentCancelledNotificationHandler,
  ],
  exports: [NOTIFICATION_PORT],
})
export class NotificationModule {}
