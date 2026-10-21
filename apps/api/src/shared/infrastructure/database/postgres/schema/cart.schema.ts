import {
  index,
  integer,
  pgEnum,
  pgTable,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { customersSchema } from './customer.schema.js';
import { ordersSchema } from './order.schema.js';
import { productsSchema } from './product.schema.js';

export const CART_STATUSES = [
  'active',
  'locked',
  'converted',
  'merged',
  'abandoned',
] as const;

export type CartStatusValue = (typeof CART_STATUSES)[number];

export const cartStatusEnum = pgEnum('cart_status', CART_STATUSES);

export const cartsSchema = pgTable(
  'carts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    customerId: uuid('customer_id').references(() => customersSchema.id, {
      onDelete: 'set null',
    }),
    guestId: varchar('guest_id', { length: 128 }),
    status: cartStatusEnum('status').notNull().default('active'),
    currency: varchar('currency', { length: 3 }).notNull().default('BDT'),
    convertedOrderId: uuid('converted_order_id').references(
      () => ordersSchema.id,
      {
        onDelete: 'set null',
      },
    ),
    lastActivityAt: timestamp('last_activity_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    version: integer('version').notNull().default(1), // OCC
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index('idx_carts_customer_status').on(table.customerId, table.status),
    index('idx_carts_guest_status').on(table.guestId, table.status),
    index('idx_carts_last_activity').on(table.lastActivityAt, table.status),
  ],
);

export const cartItemsSchema = pgTable(
  'cart_items',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    cartId: uuid('cart_id')
      .notNull()
      .references(() => cartsSchema.id, { onDelete: 'cascade' }),
    productId: uuid('product_id')
      .notNull()
      .references(() => productsSchema.id, { onDelete: 'restrict' }),
    quantity: integer('quantity').notNull().default(1),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex('idx_cart_items_cart_product').on(
      table.cartId,
      table.productId,
    ),
    index('idx_cart_items_cart_id').on(table.cartId),
  ],
);

export const cartsRelations = relations(cartsSchema, ({ one, many }) => ({
  customer: one(customersSchema, {
    fields: [cartsSchema.customerId],
    references: [customersSchema.id],
  }),
  convertedOrder: one(ordersSchema, {
    fields: [cartsSchema.convertedOrderId],
    references: [ordersSchema.id],
  }),
  items: many(cartItemsSchema),
}));

export const cartItemsRelations = relations(cartItemsSchema, ({ one }) => ({
  cart: one(cartsSchema, {
    fields: [cartItemsSchema.cartId],
    references: [cartsSchema.id],
  }),
  product: one(productsSchema, {
    fields: [cartItemsSchema.productId],
    references: [productsSchema.id],
  }),
}));
