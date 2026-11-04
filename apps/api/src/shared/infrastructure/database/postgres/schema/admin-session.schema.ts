import { index, pgTable, text, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';
import { adminUsersSchema } from './admin.schema.js';

export const adminSessionsSchema = pgTable(
  'admin_sessions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    adminId: uuid('admin_id')
      .notNull()
      .references(() => adminUsersSchema.id, { onDelete: 'cascade' }),
    tokenHash: text('token_hash').notNull(),           // SHA-256 hex of raw refresh token
    deviceInfo: text('device_info'),                    // user-agent
    ipAddress: varchar('ip_address', { length: 45 }),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),  // null = active
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('admin_sessions_admin_id_revoked_at_idx').on(table.adminId, table.revokedAt),
    index('admin_sessions_token_hash_idx').on(table.tokenHash),
    index('admin_sessions_expires_at_idx').on(table.expiresAt),
  ],
);

export type AdminSessionSelectRow = typeof adminSessionsSchema.$inferSelect;
export type AdminSessionInsertRow = typeof adminSessionsSchema.$inferInsert;
export const adminSessionsTable = adminSessionsSchema;
