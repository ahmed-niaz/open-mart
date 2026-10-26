import {
  boolean,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';

export const mediaAssetsSchema = pgTable(
  'media_assets',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    fileName: varchar('file_name', { length: 255 }).notNull(),
    originalName: varchar('original_name', { length: 255 }).notNull(),
    mimeType: varchar('mime_type', { length: 100 }).notNull(),
    fileSizeBytes: integer('file_size_bytes').notNull().default(0),
    url: text('url').notNull(),
    storageKey: varchar('storage_key', { length: 500 }).notNull().unique(),
    altText: varchar('alt_text', { length: 255 }).notNull().default(''),
    width: integer('width'),
    height: integer('height'),
    uploadedBy: varchar('uploaded_by', { length: 100 }),
    usageCount: integer('usage_count').notNull().default(0),
    isArchived: boolean('is_archived').notNull().default(false),
    version: integer('version').notNull().default(1),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index('media_assets_storage_key_idx').on(table.storageKey),
    index('media_assets_mime_type_idx').on(table.mimeType),
    index('media_assets_created_at_idx').on(table.createdAt),
  ],
);

export type MediaAssetSelectRow = typeof mediaAssetsSchema.$inferSelect;
export type MediaAssetInsertRow = typeof mediaAssetsSchema.$inferInsert;
export const mediaAssetsTable = mediaAssetsSchema;
