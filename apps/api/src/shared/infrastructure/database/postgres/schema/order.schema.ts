import {
  index,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { customersSchema } from './customer.schema.js';
import { productsSchema } from './product.schema.js';

export const ORDER_STATUSES = [
  'pending',
  'confirmed',
  'processing',
  'shipped',
  'delivered',
  'cancelled',
  'returned',
] as const;

export type OrderStatusValue = (typeof ORDER_STATUSES)[number];

export const orderStatusEnum = pgEnum('order_status', ORDER_STATUSES);

export const ordersSchema = pgTable(
  'orders',
  {
    id: uuid('id').primaryKey(),
    // Optional customer link (allows guest checkout or registered customer)
    customerId: uuid('customer_id').references(() => customersSchema.id, {
      onDelete: 'set null',
    }),
    status: orderStatusEnum('status').notNull().default('pending'),
    totalAmount: integer('total_amount').notNull(), // minor units / cents
    totalCurrency: varchar('total_currency', { length: 3 })
      .notNull()
      .default('USD'),

    // Discount Price Snapshot
    discountCode: varchar('discount_code', { length: 50 }),
    discountType: varchar('discount_type', { length: 30 }),
    discountAmount: integer('discount_amount').notNull().default(0),

    // Shipping Address (Bangladesh standard delivery address)
    recipientName: varchar('recipient_name', { length: 100 }).notNull(),
    recipientPhone: varchar('recipient_phone', { length: 20 }).notNull(),
    altPhone: varchar('alt_phone', { length: 20 }),
    shippingDivision: varchar('shipping_division', { length: 50 }).notNull(),
    shippingDistrict: varchar('shipping_district', { length: 50 }).notNull(),
    shippingCity: varchar('shipping_city', { length: 100 }).notNull(),
    shippingArea: varchar('shipping_area', { length: 100 }).notNull(),
    shippingAddressLine: text('shipping_address_line').notNull(),
    shippingPostalCode: varchar('shipping_postal_code', { length: 10 }),
    shippingCountry: varchar('shipping_country', { length: 2 })
      .notNull()
      .default('BD'),

    // Fulfillment / Tracking
    courierName: varchar('courier_name', { length: 100 }),
    trackingNumber: varchar('tracking_number', { length: 100 }),
    notes: text('notes'),

    // Lifecycle timestamps & analytics
    shippedAt: timestamp('shipped_at', { withTimezone: true }),
    deliveredAt: timestamp('delivered_at', { withTimezone: true }),
    cancelledAt: timestamp('cancelled_at', { withTimezone: true }),
    cancellationReason: text('cancellation_reason'),

    // Optimistic Concurrency Control (OCC)
    version: integer('version').notNull().default(1),

    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index('orders_customer_id_idx').on(table.customerId),
    index('orders_status_idx').on(table.status),
    index('orders_created_at_idx').on(table.createdAt),
    index('orders_created_at_status_idx').on(table.createdAt, table.status),
  ],
);

export const orderItemsSchema = pgTable(
  'order_items',
  {
    id: uuid('id').primaryKey(),
    orderId: uuid('order_id')
      .notNull()
      .references(() => ordersSchema.id, { onDelete: 'cascade' }),
    productId: uuid('product_id').references(() => productsSchema.id, {
      onDelete: 'set null',
    }),
    productName: varchar('product_name', { length: 255 }).notNull(),
    productSku: varchar('product_sku', { length: 100 }).notNull(),
    unitPriceAmount: integer('unit_price_amount').notNull(), // in cents, frozen at purchase
    unitPriceCurrency: varchar('unit_price_currency', { length: 3 })
      .notNull()
      .default('USD'),
    // Allocated line-item discount amount (poisha / cents)
    discountAmount: integer('discount_amount').notNull().default(0),
    quantity: integer('quantity').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index('order_items_order_id_idx').on(table.orderId),
    index('order_items_product_id_idx').on(table.productId),
    index('order_items_order_product_idx').on(table.orderId, table.productId),
  ],
);

export const orderStatusHistorySchema = pgTable(
  'order_status_history',
  {
    id: uuid('id').primaryKey(),
    orderId: uuid('order_id')
      .notNull()
      .references(() => ordersSchema.id, { onDelete: 'cascade' }),
    fromStatus: varchar('from_status', { length: 30 }),
    toStatus: varchar('to_status', { length: 30 }).notNull(),
    changedBy: varchar('changed_by', { length: 100 }), // customer ID, admin ID, or 'system'
    reason: text('reason'),
    changedAt: timestamp('changed_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index('order_status_history_order_id_idx').on(table.orderId),
    index('order_status_history_changed_at_idx').on(table.changedAt),
  ],
);

export const ordersRelations = relations(ordersSchema, ({ many, one }) => ({
  items: many(orderItemsSchema),
  statusHistory: many(orderStatusHistorySchema),
  customer: one(customersSchema, {
    fields: [ordersSchema.customerId],
    references: [customersSchema.id],
  }),
}));

export const orderItemsRelations = relations(orderItemsSchema, ({ one }) => ({
  order: one(ordersSchema, {
    fields: [orderItemsSchema.orderId],
    references: [ordersSchema.id],
  }),
  product: one(productsSchema, {
    fields: [orderItemsSchema.productId],
    references: [productsSchema.id],
  }),
}));

export const orderStatusHistoryRelations = relations(
  orderStatusHistorySchema,
  ({ one }) => ({
    order: one(ordersSchema, {
      fields: [orderStatusHistorySchema.orderId],
      references: [ordersSchema.id],
    }),
  }),
);

export type OrderSelectRow = typeof ordersSchema.$inferSelect;
export type OrderInsertRow = typeof ordersSchema.$inferInsert;
export type OrderItemSelectRow = typeof orderItemsSchema.$inferSelect;
export type OrderItemInsertRow = typeof orderItemsSchema.$inferInsert;
export type OrderStatusHistorySelectRow =
  typeof orderStatusHistorySchema.$inferSelect;
export type OrderStatusHistoryInsertRow =
  typeof orderStatusHistorySchema.$inferInsert;
