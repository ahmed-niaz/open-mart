import {
  boolean,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';

export interface ProductMediaPersistence {
  url: string;
  altText?: string;
  isThumbnail?: boolean;
}

export interface ProductCategoryPersistence {
  name: string;
  description?: string;
}

export interface ProductVariantPersistence {
  id: string;
  name?: string;
  type?: string;
  color?: string;
  options?: Record<string, string>;
  sku?: string;
  priceAmount?: number;
  priceCurrency?: string;
  inventoryQuantity?: number;
}

export const productsSchema = pgTable('products', {
  id: uuid('id').primaryKey(),
  title: varchar('title', { length: 255 }).notNull(),
  description: text('description').notNull().default(''),
  media: jsonb('media')
    .$type<ProductMediaPersistence[]>()
    .notNull()
    .default([]),
  tags: jsonb('tags').$type<string[]>().notNull().default([]),
  status: varchar('status', { length: 20 }).notNull().default('draft'),
  category: jsonb('category').$type<ProductCategoryPersistence>(),

  // Pricing
  unitPriceAmount: integer('unit_price_amount').notNull(),
  unitPriceCurrency: varchar('unit_price_currency', { length: 3 })
    .notNull()
    .default('USD'),
  basePriceAmount: integer('base_price_amount'),
  basePriceCurrency: varchar('base_price_currency', { length: 3 }),
  compareAtPriceAmount: integer('compare_at_price_amount'),
  compareAtPriceCurrency: varchar('compare_at_price_currency', { length: 3 }),

  // Inventory
  sku: varchar('sku', { length: 255 }).notNull().unique(),
  inventoryQuantity: integer('inventory_quantity').notNull().default(0),
  trackQuantity: boolean('track_quantity').notNull().default(true),

  // Variants & OCC
  variants: jsonb('variants')
    .$type<ProductVariantPersistence[]>()
    .notNull()
    .default([]),
  version: integer('version').notNull().default(1),

  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type ProductSelectRow = typeof productsSchema.$inferSelect;
export type ProductInsertRow = typeof productsSchema.$inferInsert;
export const productsTable = productsSchema;
