import {
  boolean,
  check,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

export const ADMIN_ROLES = [
  'super-admin',
  'admin',
  'manager',
  'support',
] as const;

export type AdminRoleType = (typeof ADMIN_ROLES)[number];

export const adminUsersSchema = pgTable(
  'admin_users',
  {
    id: uuid('id').primaryKey(),
    email: varchar('email', { length: 255 }).notNull(),
    passwordHash: varchar('password_hash', { length: 255 }).notNull(),
    firstName: varchar('first_name', { length: 150 }).notNull(),
    lastName: varchar('last_name', { length: 150 }).notNull(),
    role: varchar('role', { length: 50 }).notNull(),
    phoneNumber: varchar('phone_number', { length: 30 }),
    avatarUrl: text('avatar_url'),
    isActive: boolean('is_active').notNull().default(true),
    mustChangePassword: boolean('must_change_password')
      .notNull()
      .default(false),
    version: integer('version').notNull().default(1),
    lastLoginAt: timestamp('last_login_at', { withTimezone: true }),
    lastLoginIp: varchar('last_login_ip', { length: 45 }),

    // Audit & Lifecycle Columns
    createdBy: uuid('created_by'),
    deactivatedAt: timestamp('deactivated_at', { withTimezone: true }),
    deactivatedBy: uuid('deactivated_by'),
    deactivationReason: text('deactivation_reason'),

    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex('admin_users_lower_email_idx').on(sql`lower(${table.email})`),
    index('admin_users_role_idx').on(table.role),
    index('admin_users_is_active_idx').on(table.isActive),
    check(
      'admin_role_check',
      sql`${table.role} IN ('super-admin', 'admin', 'manager', 'support')`,
    ),
  ],
);

export const adminAuditLogsSchema = pgTable(
  'admin_audit_logs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    adminId: uuid('admin_id')
      .notNull()
      .references(() => adminUsersSchema.id, { onDelete: 'restrict' }),
    action: varchar('action', { length: 100 }).notNull(),
    targetId: varchar('target_id', { length: 100 }),
    details: jsonb('details'),
    ipAddress: varchar('ip_address', { length: 45 }),
    userAgent: text('user_agent'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index('admin_audit_logs_admin_id_idx').on(table.adminId),
    index('admin_audit_logs_action_idx').on(table.action),
    index('admin_audit_logs_created_at_idx').on(table.createdAt),
  ],
);

export type AdminUserSelectRow = typeof adminUsersSchema.$inferSelect;
export type AdminUserInsertRow = typeof adminUsersSchema.$inferInsert;
export type AdminAuditLogSelectRow = typeof adminAuditLogsSchema.$inferSelect;
export type AdminAuditLogInsertRow = typeof adminAuditLogsSchema.$inferInsert;

export const adminUsersTable = adminUsersSchema;
export const adminAuditLogsTable = adminAuditLogsSchema;
