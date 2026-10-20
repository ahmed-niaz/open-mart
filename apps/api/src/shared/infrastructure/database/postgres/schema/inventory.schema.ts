import {
  boolean,
  check,
  index,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import { relations, sql } from 'drizzle-orm';
import { productsSchema } from './product.schema.js';

export const RESERVATION_STATUSES = [
  'reserved',
  'committed',
  'released',
  'expired',
  'reversed',
] as const;

export type ReservationStatusValue = (typeof RESERVATION_STATUSES)[number];
export const reservationStatusEnum = pgEnum(
  'reservation_status',
  RESERVATION_STATUSES,
);

export const MOVEMENT_REASONS = [
  'reservation_created',
  'reservation_committed',
  'reservation_released',
  'cancellation_restock',
  'returned',
  'restock',
  'stocktake_adjustment',
  'damaged',
  'loss',
  'reservation_expired',
] as const;

export type MovementReasonValue = (typeof MOVEMENT_REASONS)[number];
export const movementReasonEnum = pgEnum('movement_reason', MOVEMENT_REASONS);

export const inventoryItemsSchema = pgTable(
  'inventory_items',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    productId: uuid('product_id')
      .references(() => productsSchema.id, { onDelete: 'restrict' })
      .notNull(),
    sku: varchar('sku', { length: 100 }).notNull().unique(),
    quantityOnHand: integer('quantity_on_hand').notNull().default(0),
    reservedQuantity: integer('reserved_quantity').notNull().default(0),
    lowStockThreshold: integer('low_stock_threshold').notNull().default(5),
    isActive: boolean('is_active').notNull().default(true),
    version: integer('version').notNull().default(1),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index('inventory_items_sku_idx').on(table.sku),
    index('inventory_items_product_id_idx').on(table.productId),
    check('chk_qty_on_hand_non_negative', sql`${table.quantityOnHand} >= 0`),
    check('chk_reserved_qty_non_negative', sql`${table.reservedQuantity} >= 0`),
    check(
      'chk_reserved_lte_on_hand',
      sql`${table.reservedQuantity} <= ${table.quantityOnHand}`,
    ),
  ],
);

export const inventoryReservationsSchema = pgTable(
  'inventory_reservations',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orderId: uuid('order_id').notNull(),
    inventoryItemId: uuid('inventory_item_id')
      .notNull()
      .references(() => inventoryItemsSchema.id, { onDelete: 'restrict' }),
    sku: varchar('sku', { length: 100 }).notNull(),
    quantity: integer('quantity').notNull(),
    status: reservationStatusEnum('status').notNull().default('reserved'),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    unique('uq_order_inventory_item').on(table.orderId, table.inventoryItemId),
    index('reservations_order_id_idx').on(table.orderId),
    index('reservations_active_expiry_idx')
      .on(table.expiresAt)
      .where(sql`${table.status} = 'reserved'`),
    check('chk_reservation_qty_positive', sql`${table.quantity} > 0`),
  ],
);

export const inventoryMovementsSchema = pgTable(
  'inventory_movements',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    inventoryItemId: uuid('inventory_item_id')
      .notNull()
      .references(() => inventoryItemsSchema.id, { onDelete: 'restrict' }),
    sku: varchar('sku', { length: 100 }).notNull(),
    reason: movementReasonEnum('reason').notNull(),
    onHandDelta: integer('on_hand_delta').notNull().default(0),
    reservedDelta: integer('reserved_delta').notNull().default(0),
    onHandAfter: integer('on_hand_after').notNull(),
    reservedAfter: integer('reserved_after').notNull(),
    actorId: varchar('actor_id', { length: 100 }),
    referenceType: varchar('reference_type', { length: 50 }).notNull(),
    referenceId: varchar('reference_id', { length: 255 }).notNull(),
    note: text('note'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index('movements_item_created_idx').on(
      table.inventoryItemId,
      table.createdAt,
    ),
    index('movements_sku_idx').on(table.sku),
  ],
);

export const inventoryItemsRelations = relations(
  inventoryItemsSchema,
  ({ one, many }) => ({
    product: one(productsSchema, {
      fields: [inventoryItemsSchema.productId],
      references: [productsSchema.id],
    }),
    reservations: many(inventoryReservationsSchema),
    movements: many(inventoryMovementsSchema),
  }),
);

export const inventoryReservationsRelations = relations(
  inventoryReservationsSchema,
  ({ one }) => ({
    inventoryItem: one(inventoryItemsSchema, {
      fields: [inventoryReservationsSchema.inventoryItemId],
      references: [inventoryItemsSchema.id],
    }),
  }),
);

export const inventoryMovementsRelations = relations(
  inventoryMovementsSchema,
  ({ one }) => ({
    inventoryItem: one(inventoryItemsSchema, {
      fields: [inventoryMovementsSchema.inventoryItemId],
      references: [inventoryItemsSchema.id],
    }),
  }),
);

export type InventoryItemSelectRow = typeof inventoryItemsSchema.$inferSelect;
export type InventoryItemInsertRow = typeof inventoryItemsSchema.$inferInsert;
export type InventoryReservationSelectRow =
  typeof inventoryReservationsSchema.$inferSelect;
export type InventoryReservationInsertRow =
  typeof inventoryReservationsSchema.$inferInsert;
export type InventoryMovementSelectRow =
  typeof inventoryMovementsSchema.$inferSelect;
export type InventoryMovementInsertRow =
  typeof inventoryMovementsSchema.$inferInsert;
