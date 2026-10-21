import { Inject, Injectable, Logger } from '@nestjs/common';
import { eq, sql } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';

import {
  DRIZZLE,
  type DrizzleDB,
} from '../database/postgres/drizzle.provider.js';
import {
  outboxMessagesSchema,
  type OutboxMessageSelectRow,
} from '../database/postgres/schema/outbox.schema.js';

@Injectable()
export class OutboxService {
  private readonly logger = new Logger(OutboxService.name);
  private sweepListener?: () => void;

  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  /**
   * Registers a callback (from OutboxProcessorJob) to wake up on newly staged events.
   */
  onSweepTrigger(callback: () => void): void {
    this.sweepListener = callback;
  }

  /**
   * Wakes up the outbox poller asynchronously (near-zero latency).
   */
  triggerSweep(): void {
    if (this.sweepListener) {
      setImmediate(() => {
        try {
          this.sweepListener?.();
        } catch (err: any) {
          this.logger.error(`Sweep trigger error: ${err.message}`);
        }
      });
    }
  }

  /**
   * Atomically stages domain events into the outbox table inside an existing database transaction.
   */
  async stageEvents(
    tx: any,
    aggregateType: string,
    aggregateId: string,
    events: any[],
  ): Promise<void> {
    if (!events || events.length === 0) {
      return;
    }

    const executor = tx || this.db;
    const rows = events.map((event) => {
      const eventType =
        event.constructor?.name && event.constructor.name !== 'Object'
          ? event.constructor.name
          : event.__type || 'UnknownDomainEvent';

      return {
        id: randomUUID(),
        aggregateType,
        aggregateId,
        eventType,
        payload: event,
        status: 'pending' as const,
        retryCount: 0,
        createdAt: new Date(),
      };
    });

    await executor.insert(outboxMessagesSchema).values(rows);
    this.logger.debug(
      `Staged ${rows.length} domain event(s) for ${aggregateType}:${aggregateId} in outbox.`,
    );
  }

  /**
   * Concurrently claims a batch of pending events using FOR UPDATE SKIP LOCKED.
   * Multi-instance safe: No two workers will claim the same message.
   */
  async claimPendingBatch(limit = 50): Promise<OutboxMessageSelectRow[]> {
    // In postgres-js / Drizzle:
    const claimed = await this.db.execute(sql`
      SELECT id, aggregate_type, aggregate_id, event_type, payload, status, retry_count, last_error, created_at, published_at
      FROM outbox_messages
      WHERE status = 'pending' AND retry_count < 5
      ORDER BY created_at ASC
      FOR UPDATE SKIP LOCKED
      LIMIT ${limit};
    `);

    return (claimed as any) || [];
  }

  /**
   * Marks an outbox message as successfully published.
   */
  async markPublished(id: string): Promise<void> {
    await this.db
      .update(outboxMessagesSchema)
      .set({
        status: 'published',
        publishedAt: new Date(),
      })
      .where(eq(outboxMessagesSchema.id, id));
  }

  /**
   * Increments retry count and sets last error message.
   * Dead-letters message to 'failed' if retry count reaches threshold.
   */
  async recordFailure(id: string, errorMessage: string): Promise<void> {
    await this.db.execute(sql`
      UPDATE outbox_messages
      SET retry_count = retry_count + 1,
          last_error = ${errorMessage.slice(0, 1000)},
          status = CASE WHEN retry_count + 1 >= 5 THEN 'failed' ELSE 'pending' END
      WHERE id = ${id};
    `);
  }
}
