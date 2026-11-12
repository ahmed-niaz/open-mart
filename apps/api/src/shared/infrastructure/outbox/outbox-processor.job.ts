import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
  Optional,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron } from '@nestjs/schedule';
import { EventBus } from '@nestjs/cqrs';
import postgres from 'postgres';

import { OutboxService } from './outbox.service.js';
import { deserializeOutboxEvent } from './event-registry.js';

@Injectable()
export class OutboxProcessorJob implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(OutboxProcessorJob.name);
  private isProcessing = false;
  private listenClient?: ReturnType<typeof postgres>;

  constructor(
    private readonly outboxService: OutboxService,
    private readonly eventBus: EventBus,
    @Optional() private readonly configService?: ConfigService,
  ) {}

  async onModuleInit(): Promise<void> {
    this.outboxService.onSweepTrigger(() => {
      void this.sweepOutbox();
    });

    if (process.env.VITEST) {
      return;
    }

    const dbUrl = this.configService?.get<string>('POSTGRES_DB_URL');
    if (!dbUrl) {
      return;
    }

    try {
      this.listenClient = postgres(dbUrl, {
        max: 1,
        idle_timeout: 0,
        connect_timeout: 10,
      });

      await this.listenClient.listen('outbox_wakeup', () => {
        void this.sweepOutbox();
      });
      this.logger.log(
        "Subscribed to PostgreSQL 'outbox_wakeup' LISTEN/NOTIFY channel.",
      );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.warn(
        `Failed to start PostgreSQL outbox LISTEN subscriber (${msg}). Falling back to periodic Cron sweep.`,
      );
    }
  }

  async onModuleDestroy(): Promise<void> {
    if (this.listenClient) {
      try {
        await this.listenClient.end({ timeout: 2 });
      } catch {
        // Ignore teardown errors during shutdown
      }
    }
  }

  /**
   * Safety fallback sweep every 5 seconds in case a NOTIFY signal is missed.
   * Primary low-latency wakeup uses PostgreSQL LISTEN/NOTIFY (`outbox_wakeup`).
   * Multi-instance safe: Uses SELECT ... FOR UPDATE SKIP LOCKED.
   */
  @Cron('*/5 * * * * *')
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
