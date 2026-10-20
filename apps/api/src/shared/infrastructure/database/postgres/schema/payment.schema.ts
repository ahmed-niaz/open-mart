import {
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import { relations, sql } from 'drizzle-orm';
import { ordersSchema } from './order.schema.js';
import { customersSchema } from './customer.schema.js';

export const PAYMENT_TXN_STATUSES = [
  'pending',
  'processing',
  'completed',
  'failed',
  'cancelled',
  'needs_review',
  'refunded',
  'partially_refunded',
] as const;

export type PaymentTxnStatusValue = (typeof PAYMENT_TXN_STATUSES)[number];

export const PAYMENT_PROVIDERS = ['stripe', 'cod', 'sslcommerz'] as const;

export type PaymentProviderValue = (typeof PAYMENT_PROVIDERS)[number];

export const paymentTxnStatusEnum = pgEnum('payment_txn_status', PAYMENT_TXN_STATUSES);

export const paymentProviderEnum = pgEnum('payment_provider', PAYMENT_PROVIDERS);

export const paymentsSchema = pgTable(
  'payments',
  {
    id: uuid('id').primaryKey(),
    // ON DELETE RESTRICT: financial records are never deleted when an order is deleted
    orderId: uuid('order_id')
      .notNull()
      .references(() => ordersSchema.id, { onDelete: 'restrict' }),
    customerId: uuid('customer_id').references(() => customersSchema.id, {
      onDelete: 'set null',
    }),
    provider: paymentProviderEnum('provider').notNull(),
    status: paymentTxnStatusEnum('status').notNull().default('pending'),
    amount: integer('amount').notNull(), // minor currency units (cents)
    currency: varchar('currency', { length: 3 }).notNull().default('USD'),
    transactionId: varchar('transaction_id', { length: 255 }), // Gateway reference / session ID
    idempotencyKey: varchar('idempotency_key', { length: 128 }),
    failureCode: varchar('failure_code', { length: 100 }),
    failureReason: text('failure_reason'),
    providerRefundId: varchar('provider_refund_id', { length: 255 }),
    refundedAmount: integer('refunded_amount').notNull().default(0),
    paidAt: timestamp('paid_at', { withTimezone: true }),
    metadata: jsonb('metadata').$type<Record<string, unknown>>(),
    version: integer('version').notNull().default(1), // OCC
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index('payments_order_id_idx').on(table.orderId),
    index('payments_transaction_id_idx').on(table.transactionId),
    index('payments_status_idx').on(table.status),
    // Partial unique index: only 1 active payment attempt per order at any time
    uniqueIndex('payments_order_active_idx')
      .on(table.orderId)
      .where(sql`status IN ('pending', 'processing', 'completed')`),
  ],
);

export const paymentWebhookEventsSchema = pgTable(
  'payment_webhook_events',
  {
    id: uuid('id').primaryKey(),
    provider: paymentProviderEnum('provider').notNull(),
    eventId: varchar('event_id', { length: 255 }).notNull(),
    eventType: varchar('event_type', { length: 100 }).notNull(),
    payloadHash: varchar('payload_hash', { length: 64 }),
    processedAt: timestamp('processed_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex('payment_webhook_provider_event_idx').on(
      table.provider,
      table.eventId,
    ),
  ],
);

export const paymentsRelations = relations(paymentsSchema, ({ one }) => ({
  order: one(ordersSchema, {
    fields: [paymentsSchema.orderId],
    references: [ordersSchema.id],
  }),
  customer: one(customersSchema, {
    fields: [paymentsSchema.customerId],
    references: [customersSchema.id],
  }),
}));

