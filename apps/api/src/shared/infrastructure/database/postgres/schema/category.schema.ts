import {
  boolean,
  foreignKey,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';

export const categoriesSchema = pgTable(
  'categories',
  {
    id: uuid('id').primaryKey(),
    name: varchar('name', { length: 150 }).notNull(),
    slug: varchar('slug', { length: 150 }).notNull().unique(),
    description: text('description').notNull().default(''),
    parentId: uuid('parent_id'),
    imageUrl: text('image_url'),
    isActive: boolean('is_active').notNull().default(true),
    displayOrder: integer('display_order').notNull().default(0),
    version: integer('version').notNull().default(1),

    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex('categories_slug_idx').on(table.slug),
    index('categories_parent_id_idx').on(table.parentId),
    foreignKey({
      columns: [table.parentId],
      foreignColumns: [table.id],
      name: 'categories_parent_id_fk',
    }).onDelete('restrict'),
  ],
);

export type CategorySelectRow = typeof categoriesSchema.$inferSelect;
export type CategoryInsertRow = typeof categoriesSchema.$inferInsert;
export const categoriesTable = categoriesSchema;
