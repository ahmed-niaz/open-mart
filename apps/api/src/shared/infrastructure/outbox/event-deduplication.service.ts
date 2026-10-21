import { Inject, Injectable, Logger } from '@nestjs/common';
import { and, eq } from 'drizzle-orm';

import {
  DRIZZLE,
  type DrizzleDB,
} from '../database/postgres/drizzle.provider.js';
import { processedEventsSchema } from '../database/postgres/schema/outbox.schema.js';

@Injectable()
export class EventDeduplicationService {
  private readonly logger = new Logger(EventDeduplicationService.name);

  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  /**
   * Checks whether the given event has already been handled by this consumer.
   */
  async hasProcessed(eventId: string, handlerName: string): Promise<boolean> {
    const rows = await this.db
      .select({ eventId: processedEventsSchema.eventId })
      .from(processedEventsSchema)
      .where(
        and(
          eq(processedEventsSchema.eventId, eventId),
          eq(processedEventsSchema.handlerName, handlerName),
        ),
      )
      .limit(1);

    return rows.length > 0;
  }

  /**
   * Marks an event as processed for the given handler.
   */
  async markProcessed(eventId: string, handlerName: string): Promise<void> {
    try {
      await this.db.insert(processedEventsSchema).values({
        eventId,
        handlerName,
        processedAt: new Date(),
      });
    } catch (err: any) {
      // 23505 = unique_violation: already recorded by concurrent thread
      if (err.code === '23505') {
        return;
      }
      throw err;
    }
  }

  /**
   * Helper that executes the consumer handler idempotently.
   * If the event was already processed, it gracefully skips execution.
   */
  async executeIdempotently(
    eventId: string | undefined,
    handlerName: string,
    handlerFn: () => Promise<void>,
  ): Promise<void> {
    if (!eventId) {
      // Fallback for direct in-memory calls or tests without eventId
      await handlerFn();
      return;
    }

    const alreadyProcessed = await this.hasProcessed(eventId, handlerName);
    if (alreadyProcessed) {
      this.logger.debug(
        `Event '${eventId}' was already processed by handler '${handlerName}'. Skipping duplicate delivery.`,
      );
      return;
    }

    await handlerFn();
    await this.markProcessed(eventId, handlerName);
  }
}

