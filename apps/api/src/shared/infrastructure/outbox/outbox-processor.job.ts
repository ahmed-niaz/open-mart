import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { EventBus } from '@nestjs/cqrs';

import { OutboxService } from './outbox.service.js';
import { deserializeOutboxEvent } from './event-registry.js';

@Injectable()
export class OutboxProcessorJob implements OnModuleInit {
  private readonly logger = new Logger(OutboxProcessorJob.name);
  private isProcessing = false;

  constructor(
    private readonly outboxService: OutboxService,
    private readonly eventBus: EventBus,
  ) {}

  onModuleInit(): void {
    this.outboxService.onSweepTrigger(() => {
      void this.sweepOutbox();
    });
  }

  /**
   * Sweeps pending outbox events every 2 seconds.
   * Multi-instance safe: Uses SELECT ... FOR UPDATE SKIP LOCKED.
   */
  @Cron('*/2 * * * * *')
  async sweepOutbox(): Promise<void> {
    if (this.isProcessing) {
      return;
    }

    this.isProcessing = true;

    try {
      const batch = await this.outboxService.claimPendingBatch(50);
      if (batch.length === 0) {
        return;
      }

      this.logger.debug(
        `Claimed ${batch.length} outbox message(s) for dispatch.`,
      );

      for (const raw of batch) {
        const row = raw as any;
        const messageId = row.id as string;
        const eventType = row.event_type as string;
        const payload = row.payload;

        try {
          const domainEvent = deserializeOutboxEvent(
            eventType,
            payload,
            messageId,
          );

          // Publish to NestJS CQRS EventBus
          await this.eventBus.publish(domainEvent);

          // Mark outbox row published
          await this.outboxService.markPublished(messageId);
        } catch (publishErr: any) {
          this.logger.error(
            `Failed to publish outbox event '${messageId}' (${eventType}): ${publishErr.message}`,
            publishErr.stack,
          );

          await this.outboxService.recordFailure(
            messageId,
            publishErr.message || String(publishErr),
          );
        }
      }
    } catch (err: any) {
      this.logger.error(
        `Error in OutboxProcessorJob sweep: ${err.message}`,
        err.stack,
      );
    } finally {
      this.isProcessing = false;
    }
  }
}
