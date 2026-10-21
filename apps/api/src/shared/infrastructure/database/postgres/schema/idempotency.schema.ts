import {
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  timestamp,
  varchar,
} from 'drizzle-orm/pg-core';

export const idempotencyKeysSchema = pgTable(
  'idempotency_keys',
  {
    key: varchar('key', { length: 128 }).notNull(),
    scope: varchar('scope', { length: 100 }).notNull(), // customer_id or guest identifier
    requestPath: varchar('request_path', { length: 255 }).notNull(),
    requestHash: varchar('request_hash', { length: 64 }).notNull(), // SHA-256 of request payload
    status: varchar('status', { length: 20 }).notNull().default('in_progress'), // 'in_progress' | 'completed'
    responseCode: integer('response_code'),
    responseBody: jsonb('response_body'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(), // 24-hour TTL
  },
  (table) => [
    primaryKey({ columns: [table.key, table.scope, table.requestPath] }),
    index('idx_idempotency_expires').on(table.expiresAt),
  ],
);

export type IdempotencyKeySelectRow = typeof idempotencyKeysSchema.$inferSelect;
export type IdempotencyKeyInsertRow = typeof idempotencyKeysSchema.$inferInsert;
