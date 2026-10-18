import {
  boolean,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';

export const customersSchema = pgTable(
  'customers',
  {
    id: uuid('id').primaryKey(),
    email: varchar('email', { length: 255 }).notNull(),
    passwordHash: varchar('password_hash', { length: 255 }),
    googleId: varchar('google_id', { length: 255 }),
    firstName: varchar('first_name', { length: 150 }).notNull(),
    lastName: varchar('last_name', { length: 150 }).notNull(),
    phoneNumber: varchar('phone_number', { length: 30 }),
    avatarUrl: text('avatar_url'),
    isActive: boolean('is_active').notNull().default(true),
    isEmailVerified: boolean('is_email_verified').notNull().default(false),
    version: integer('version').notNull().default(1),
    lastLoginAt: timestamp('last_login_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex('customers_email_idx').on(table.email),
    uniqueIndex('customers_google_id_idx').on(table.googleId),
    index('customers_phone_number_idx').on(table.phoneNumber),
    index('customers_is_active_idx').on(table.isActive),
  ],
);

export type CustomerSelectRow = typeof customersSchema.$inferSelect;
export type CustomerInsertRow = typeof customersSchema.$inferInsert;
export const customersTable = customersSchema;
