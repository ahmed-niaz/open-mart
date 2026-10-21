import {
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';

export const outboxMessagesSchema = pgTable(
  'outbox_messages',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    aggregateType: varchar('aggregate_type', { length: 50 }).notNull(),
    aggregateId: varchar('aggregate_id', { length: 100 }).notNull(),
    eventType: varchar('event_type', { length: 100 }).notNull(),
    payload: jsonb('payload').notNull(),
    status: varchar('status', { length: 20 }).notNull().default('pending'), // 'pending' | 'published' | 'failed'
    retryCount: integer('retry_count').notNull().default(0),
    lastError: text('last_error'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    publishedAt: timestamp('published_at', { withTimezone: true }),
  },
  (table) => [
    index('idx_outbox_pending').on(table.status, table.createdAt),
    index('idx_outbox_aggregate').on(table.aggregateType, table.aggregateId),
  ],
);

export const processedEventsSchema = pgTable(
  'processed_events',
  {
    eventId: uuid('event_id').notNull(),
    handlerName: varchar('handler_name', { length: 100 }).notNull(),
    processedAt: timestamp('processed_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.eventId, table.handlerName] }),
    index('idx_processed_events_at').on(table.processedAt),
  ],
);

export type OutboxMessageSelectRow = typeof outboxMessagesSchema.$inferSelect;
export type OutboxMessageInsertRow = typeof outboxMessagesSchema.$inferInsert;
export type ProcessedEventSelectRow = typeof processedEventsSchema.$inferSelect;
export type ProcessedEventInsertRow = typeof processedEventsSchema.$inferInsert;

