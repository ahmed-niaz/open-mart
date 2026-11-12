import { Inject, Injectable, Logger } from '@nestjs/common';
import type { Queue } from 'bullmq';
import {
  DIRECT_NOTIFICATION_PORT,
  type NotificationPort,
  type SendEmailInput,
} from '../../application/ports/notification.port.js';
import { QueueConnectionService } from '../../../shared/infrastructure/queue/queue.service.js';
import { QUEUE_NAMES } from '../../../shared/infrastructure/queue/queue.constants.js';

@Injectable()
export class BullMqNotificationAdapter implements NotificationPort {
  private readonly logger = new Logger(BullMqNotificationAdapter.name);
  private readonly queue: Queue<SendEmailInput, any, string>;

  constructor(
    private readonly queueConnection: QueueConnectionService,
    @Inject(DIRECT_NOTIFICATION_PORT)
    private readonly directNotification: NotificationPort,
  ) {
    this.queue = this.queueConnection.getOrCreateQueue<SendEmailInput>(
      QUEUE_NAMES.NOTIFICATIONS,
      {
        attempts: 5,
        backoff: {
          type: 'exponential',
          delay: 2000,
        },
      },
    );
  }

  async sendEmail(input: SendEmailInput): Promise<void> {
    if (this.queueConnection.isProducerReady()) {
      try {
        const job = await this.queue.add('send-email', input);
        this.logger.debug(
          `Enqueued email job '${job.id}' -> ${input.to} (${input.subject})`,
        );
        return;
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        this.logger.warn(
          `Failed to enqueue email to BullMQ (${msg}). Failing open to inline delivery.`,
        );
      }
    } else {
      this.logger.warn(
        `BullMQ Queue Redis is not ready. Failing open to inline email delivery for '${input.to}'.`,
      );
    }

    try {
      await this.directNotification.sendEmail(input);
    } catch (fallbackErr: unknown) {
      const msg =
        fallbackErr instanceof Error
          ? fallbackErr.message
          : String(fallbackErr);
      this.logger.error(
        `Inline fail-open email delivery also failed for '${input.to}': ${msg}`,
      );
    }
  }
}
