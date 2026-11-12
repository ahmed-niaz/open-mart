import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import type { Job } from 'bullmq';
import {
  DIRECT_NOTIFICATION_PORT,
  type NotificationPort,
  type SendEmailInput,
} from '../../application/ports/notification.port.js';
import { QueueConnectionService } from '../../../shared/infrastructure/queue/queue.service.js';
import { QUEUE_NAMES } from '../../../shared/infrastructure/queue/queue.constants.js';

@Injectable()
export class NotificationWorkerProcessor implements OnModuleInit {
  private readonly logger = new Logger(NotificationWorkerProcessor.name);

  constructor(
    private readonly queueConnection: QueueConnectionService,
    @Inject(DIRECT_NOTIFICATION_PORT)
    private readonly directNotification: NotificationPort,
  ) {}

  onModuleInit(): void {
    if (!this.queueConnection.shouldRunWorkers()) {
      return;
    }

    this.queueConnection.createWorker<SendEmailInput>(
      QUEUE_NAMES.NOTIFICATIONS,
      async (job: Job<SendEmailInput>) => {
        this.logger.log(
          `Processing email job '${job.id}' -> ${job.data.to} (attempt ${job.attemptsMade + 1})`,
        );
        await this.directNotification.sendEmail(job.data);
      },
      { concurrency: 5 },
    );
  }
}
