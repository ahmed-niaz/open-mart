import {
  boolean,
  check,
  index,
  integer,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import { relations, sql } from 'drizzle-orm';
import { adminUsersSchema } from './admin.schema.js';
import { productsSchema } from './product.schema.js';
import { categoriesSchema } from './category.schema.js';
import { ordersSchema } from './order.schema.js';
import { customersSchema } from './customer.schema.js';

export const DISCOUNT_TYPES = [
  'percentage',
  'fixed_amount',
  'free_shipping',
] as const;
export type DiscountTypeValue = (typeof DISCOUNT_TYPES)[number];
export const discountTypeEnum = pgEnum('discount_type', DISCOUNT_TYPES);

export const DISCOUNT_SCOPES = [
  'all_products',
  'specific_categories',
  'specific_products',
] as const;
export type DiscountScopeValue = (typeof DISCOUNT_SCOPES)[number];
export const discountScopeEnum = pgEnum('discount_scope', DISCOUNT_SCOPES);

export const DISCOUNT_STATUSES = [
  'draft',
  'active',
  'paused',
  'archived',
] as const;
export type DiscountStatusValue = (typeof DISCOUNT_STATUSES)[number];
export const discountStatusEnum = pgEnum('discount_status', DISCOUNT_STATUSES);

export const CUSTOMER_ELIGIBILITIES = [
  'all',
  'registered_only',
  'first_order_only',
] as const;
export type CustomerEligibilityValue = (typeof CUSTOMER_ELIGIBILITIES)[number];
export const customerEligibilityEnum = pgEnum(
  'customer_eligibility',
  CUSTOMER_ELIGIBILITIES,
);

export const REDEMPTION_STATUSES = [
  'reserved',
  'confirmed',
  'released',
] as const;
export type RedemptionStatusValue = (typeof REDEMPTION_STATUSES)[number];
export const redemptionStatusEnum = pgEnum(
  'redemption_status',
  REDEMPTION_STATUSES,
);

export const discountsSchema = pgTable(
  'discounts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    code: varchar('code', { length: 50 }).notNull(),
    name: varchar('name', { length: 150 }).notNull(),
    description: text('description'),
    type: discountTypeEnum('type').notNull(),
    // Basis points (1-10000) for percentage, poisha for fixed_amount, NULL for free_shipping
    value: integer('value'),
    scope: discountScopeEnum('scope').notNull().default('all_products'),
    status: discountStatusEnum('status').notNull().default('draft'),
    customerEligibility: customerEligibilityEnum('customer_eligibility')
      .notNull()
      .default('all'),
    excludeSaleItems: boolean('exclude_sale_items').notNull().default(false),

    // Financial threshold limits (in minor currency units / poisha)
    minOrderAmount: integer('min_order_amount').notNull().default(0),
    maxDiscountAmount: integer('max_discount_amount'), // Cap for percentage and free_shipping

    // Anti-abuse and usage caps
    maxUsageLimit: integer('max_usage_limit'), // NULL = unlimited
    currentUsageCount: integer('current_usage_count').notNull().default(0),
    maxUsagePerCustomer: integer('max_usage_per_customer').notNull().default(1),

    // Lifecycle scheduling
    startsAt: timestamp('starts_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    expiresAt: timestamp('expires_at', { withTimezone: true }),

    // OCC versioning and audit
    version: integer('version').notNull().default(1),
    createdBy: uuid('created_by').references(() => adminUsersSchema.id, {
      onDelete: 'restrict',
    }),
    updatedBy: uuid('updated_by').references(() => adminUsersSchema.id, {
      onDelete: 'restrict',
    }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex('discounts_lower_code_idx').on(sql`lower(trim(${table.code}))`),
    index('discounts_status_idx').on(table.status),
    index('discounts_starts_expires_idx').on(table.startsAt, table.expiresAt),
    check(
      'chk_discount_pct_val',
      sql`${table.type} != 'percentage' OR (${table.value} >= 1 AND ${table.value} <= 10000)`,
    ),
    check(
      'chk_discount_fixed_val',
      sql`${table.type} != 'fixed_amount' OR (${table.value} > 0)`,
    ),
    check(
      'chk_discount_free_ship_val',
      sql`${table.type} != 'free_shipping' OR (${table.value} IS NULL OR ${table.value} = 0)`,
    ),
    check(
      'chk_discount_dates',
      sql`${table.expiresAt} IS NULL OR ${table.expiresAt} > ${table.startsAt}`,
    ),
    check('chk_discount_usage_non_neg', sql`${table.currentUsageCount} >= 0`),
    check(
      'chk_discount_usage_limit',
      sql`${table.maxUsageLimit} IS NULL OR ${table.currentUsageCount} <= ${table.maxUsageLimit}`,
    ),
    check('chk_discount_per_cust_pos', sql`${table.maxUsagePerCustomer} >= 1`),
  ],
);

export const discountTargetProductsSchema = pgTable(
  'discount_target_products',
  {
    discountId: uuid('discount_id')
      .notNull()
      .references(() => discountsSchema.id, { onDelete: 'cascade' }),
    productId: uuid('product_id')
      .notNull()
      .references(() => productsSchema.id, { onDelete: 'restrict' }),
  },
  (table) => [
    primaryKey({ columns: [table.discountId, table.productId] }),
    index('discount_target_products_prod_idx').on(table.productId),
  ],
);

export const discountTargetCategoriesSchema = pgTable(
  'discount_target_categories',
  {
    discountId: uuid('discount_id')
      .notNull()
      .references(() => discountsSchema.id, { onDelete: 'cascade' }),
    categoryId: uuid('category_id')
      .notNull()
      .references(() => categoriesSchema.id, { onDelete: 'restrict' }),
  },
  (table) => [
    primaryKey({ columns: [table.discountId, table.categoryId] }),
    index('discount_target_categories_cat_idx').on(table.categoryId),
  ],
);

export const discountRedemptionsSchema = pgTable(
  'discount_redemptions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    discountId: uuid('discount_id')
      .notNull()
      .references(() => discountsSchema.id, { onDelete: 'restrict' }),
    orderId: uuid('order_id')
      .notNull()
      .references(() => ordersSchema.id, { onDelete: 'restrict' }),
    customerId: uuid('customer_id').references(() => customersSchema.id, {
      onDelete: 'restrict',
    }),
    customerIdentifier: varchar('customer_identifier', {
      length: 255,
    }).notNull(),
    discountCode: varchar('discount_code', { length: 50 }).notNull(),
    discountAmount: integer('discount_amount').notNull(),
    status: redemptionStatusEnum('status').notNull().default('reserved'),
    reservedAt: timestamp('reserved_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    confirmedAt: timestamp('confirmed_at', { withTimezone: true }),
    releasedAt: timestamp('released_at', { withTimezone: true }),
  },
  (table) => [
    index('discount_redemptions_discount_id_idx').on(table.discountId),
    index('discount_redemptions_cust_ident_idx').on(
      table.discountId,
      table.customerIdentifier,
    ),
    index('discount_redemptions_order_id_idx').on(table.orderId),
    uniqueIndex('discount_redemptions_order_unique_idx').on(
      table.discountId,
      table.orderId,
    ),
  ],
);

export const discountsRelations = relations(discountsSchema, ({ many }) => ({
  targetProducts: many(discountTargetProductsSchema),
  targetCategories: many(discountTargetCategoriesSchema),
  redemptions: many(discountRedemptionsSchema),
}));

export const discountTargetProductsRelations = relations(
  discountTargetProductsSchema,
  ({ one }) => ({
    discount: one(discountsSchema, {
      fields: [discountTargetProductsSchema.discountId],
      references: [discountsSchema.id],
    }),
    product: one(productsSchema, {
      fields: [discountTargetProductsSchema.productId],
      references: [productsSchema.id],
    }),
  }),
);

export const discountTargetCategoriesRelations = relations(
  discountTargetCategoriesSchema,
  ({ one }) => ({
    discount: one(discountsSchema, {
      fields: [discountTargetCategoriesSchema.discountId],
      references: [discountsSchema.id],
    }),
    category: one(categoriesSchema, {
      fields: [discountTargetCategoriesSchema.categoryId],
      references: [categoriesSchema.id],
    }),
  }),
);

export const discountRedemptionsRelations = relations(
  discountRedemptionsSchema,
  ({ one }) => ({
    discount: one(discountsSchema, {
      fields: [discountRedemptionsSchema.discountId],
      references: [discountsSchema.id],
    }),
    order: one(ordersSchema, {
      fields: [discountRedemptionsSchema.orderId],
      references: [ordersSchema.id],
    }),
    customer: one(customersSchema, {
      fields: [discountRedemptionsSchema.customerId],
      references: [customersSchema.id],
    }),
  }),
);

export type DiscountSelectRow = typeof discountsSchema.$inferSelect;
export type DiscountInsertRow = typeof discountsSchema.$inferInsert;
export type DiscountRedemptionSelectRow =
  typeof discountRedemptionsSchema.$inferSelect;
export type DiscountRedemptionInsertRow =
  typeof discountRedemptionsSchema.$inferInsert;
