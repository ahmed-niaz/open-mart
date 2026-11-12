CREATE EXTENSION IF NOT EXISTS pg_trgm;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "products_title_trgm_idx" ON "products" USING gin ("title" gin_trgm_ops);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "products_description_trgm_idx" ON "products" USING gin ("description" gin_trgm_ops);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "products_sku_trgm_idx" ON "products" USING gin ("sku" gin_trgm_ops);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "categories_name_trgm_idx" ON "categories" USING gin ("name" gin_trgm_ops);
