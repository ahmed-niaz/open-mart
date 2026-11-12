import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';

import { StorageModule } from './shared/infrastructure/storage/storage.module.js';
import { QueueModule } from './shared/infrastructure/queue/queue.module.js';
import { DIRECT_NOTIFICATION_PORT } from './notification/application/ports/notification.port.js';
import { NodemailerNotificationAdapter } from './notification/infrastructure/adapters/nodemailer-notification.adapter.js';
import { ConsoleNotificationAdapter } from './notification/infrastructure/adapters/console-notification.adapter.js';
import { NotificationWorkerProcessor } from './notification/infrastructure/queues/notification-worker.processor.js';
import { MediaCleanupWorkerProcessor } from './media/infrastructure/queues/media-cleanup-worker.processor.js';

/**
 * Isolated headless NestJS Worker Module.
 * Consumes BullMQ background queues (SMTP email notifications, Cloudflare R2 object purges)
 * without binding HTTP controllers, Express middleware, or catalog query caches.
 */
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env.local', '.env'],
    }),
    StorageModule,
    QueueModule.forWorker(),
  ],
  providers: [
    {
      provide: DIRECT_NOTIFICATION_PORT,
      useFactory: (configService: ConfigService) => {
        const smtpUser = configService.get<string>('SMTP_USER');
        const smtpPass = configService.get<string>('SMTP_PASS');

        if (smtpUser && smtpPass) {
          return new NodemailerNotificationAdapter(configService, true);
        }
        return new ConsoleNotificationAdapter();
      },
      inject: [ConfigService],
    },
    NotificationWorkerProcessor,
    MediaCleanupWorkerProcessor,
  ],
})
export class WorkerModule {}
