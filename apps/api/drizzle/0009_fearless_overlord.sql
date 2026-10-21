CREATE TYPE "public"."customer_eligibility" AS ENUM('all', 'registered_only', 'first_order_only');--> statement-breakpoint
CREATE TYPE "public"."discount_scope" AS ENUM('all_products', 'specific_categories', 'specific_products');--> statement-breakpoint
CREATE TYPE "public"."discount_status" AS ENUM('draft', 'active', 'paused', 'archived');--> statement-breakpoint
CREATE TYPE "public"."discount_type" AS ENUM('percentage', 'fixed_amount', 'free_shipping');--> statement-breakpoint
CREATE TYPE "public"."redemption_status" AS ENUM('reserved', 'confirmed', 'released');--> statement-breakpoint
CREATE TABLE "discount_redemptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"discount_id" uuid NOT NULL,
	"order_id" uuid NOT NULL,
	"customer_id" uuid,
	"customer_identifier" varchar(255) NOT NULL,
	"discount_code" varchar(50) NOT NULL,
	"discount_amount" integer NOT NULL,
	"status" "redemption_status" DEFAULT 'reserved' NOT NULL,
	"reserved_at" timestamp with time zone DEFAULT now() NOT NULL,
	"confirmed_at" timestamp with time zone,
	"released_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "discount_target_categories" (
	"discount_id" uuid NOT NULL,
	"category_id" uuid NOT NULL,
	CONSTRAINT "discount_target_categories_discount_id_category_id_pk" PRIMARY KEY("discount_id","category_id")
);
--> statement-breakpoint
CREATE TABLE "discount_target_products" (
	"discount_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	CONSTRAINT "discount_target_products_discount_id_product_id_pk" PRIMARY KEY("discount_id","product_id")
);
--> statement-breakpoint
CREATE TABLE "discounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" varchar(50) NOT NULL,
	"name" varchar(150) NOT NULL,
	"description" text,
	"type" "discount_type" NOT NULL,
	"value" integer,
	"scope" "discount_scope" DEFAULT 'all_products' NOT NULL,
	"status" "discount_status" DEFAULT 'draft' NOT NULL,
	"customer_eligibility" "customer_eligibility" DEFAULT 'all' NOT NULL,
	"exclude_sale_items" boolean DEFAULT false NOT NULL,
	"min_order_amount" integer DEFAULT 0 NOT NULL,
	"max_discount_amount" integer,
	"max_usage_limit" integer,
	"current_usage_count" integer DEFAULT 0 NOT NULL,
	"max_usage_per_customer" integer DEFAULT 1 NOT NULL,
	"starts_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone,
	"version" integer DEFAULT 1 NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "chk_discount_pct_val" CHECK ("discounts"."type" != 'percentage' OR ("discounts"."value" >= 1 AND "discounts"."value" <= 10000)),
	CONSTRAINT "chk_discount_fixed_val" CHECK ("discounts"."type" != 'fixed_amount' OR ("discounts"."value" > 0)),
	CONSTRAINT "chk_discount_free_ship_val" CHECK ("discounts"."type" != 'free_shipping' OR ("discounts"."value" IS NULL OR "discounts"."value" = 0)),
	CONSTRAINT "chk_discount_dates" CHECK ("discounts"."expires_at" IS NULL OR "discounts"."expires_at" > "discounts"."starts_at"),
	CONSTRAINT "chk_discount_usage_non_neg" CHECK ("discounts"."current_usage_count" >= 0),
	CONSTRAINT "chk_discount_usage_limit" CHECK ("discounts"."max_usage_limit" IS NULL OR "discounts"."current_usage_count" <= "discounts"."max_usage_limit"),
	CONSTRAINT "chk_discount_per_cust_pos" CHECK ("discounts"."max_usage_per_customer" >= 1)
);
--> statement-breakpoint
ALTER TABLE "order_items" ADD COLUMN "discount_amount" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "discount_code" varchar(50);--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "discount_type" varchar(30);--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "discount_amount" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "discount_redemptions" ADD CONSTRAINT "discount_redemptions_discount_id_discounts_id_fk" FOREIGN KEY ("discount_id") REFERENCES "public"."discounts"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "discount_redemptions" ADD CONSTRAINT "discount_redemptions_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "discount_redemptions" ADD CONSTRAINT "discount_redemptions_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "discount_target_categories" ADD CONSTRAINT "discount_target_categories_discount_id_discounts_id_fk" FOREIGN KEY ("discount_id") REFERENCES "public"."discounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "discount_target_categories" ADD CONSTRAINT "discount_target_categories_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "discount_target_products" ADD CONSTRAINT "discount_target_products_discount_id_discounts_id_fk" FOREIGN KEY ("discount_id") REFERENCES "public"."discounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "discount_target_products" ADD CONSTRAINT "discount_target_products_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "discounts" ADD CONSTRAINT "discounts_created_by_admin_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."admin_users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "discounts" ADD CONSTRAINT "discounts_updated_by_admin_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."admin_users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "discount_redemptions_discount_id_idx" ON "discount_redemptions" USING btree ("discount_id");--> statement-breakpoint
CREATE INDEX "discount_redemptions_cust_ident_idx" ON "discount_redemptions" USING btree ("discount_id","customer_identifier");--> statement-breakpoint
CREATE INDEX "discount_redemptions_order_id_idx" ON "discount_redemptions" USING btree ("order_id");--> statement-breakpoint
CREATE UNIQUE INDEX "discount_redemptions_order_unique_idx" ON "discount_redemptions" USING btree ("discount_id","order_id");--> statement-breakpoint
CREATE INDEX "discount_target_categories_cat_idx" ON "discount_target_categories" USING btree ("category_id");--> statement-breakpoint
CREATE INDEX "discount_target_products_prod_idx" ON "discount_target_products" USING btree ("product_id");--> statement-breakpoint
CREATE UNIQUE INDEX "discounts_lower_code_idx" ON "discounts" USING btree (lower(trim("code")));--> statement-breakpoint
CREATE INDEX "discounts_status_idx" ON "discounts" USING btree ("status");--> statement-breakpoint
CREATE INDEX "discounts_starts_expires_idx" ON "discounts" USING btree ("starts_at","expires_at");