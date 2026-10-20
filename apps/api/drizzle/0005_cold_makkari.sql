CREATE TYPE "public"."payment_provider" AS ENUM('stripe', 'cod', 'sslcommerz');--> statement-breakpoint
CREATE TYPE "public"."payment_txn_status" AS ENUM('pending', 'processing', 'completed', 'failed', 'cancelled', 'needs_review', 'refunded', 'partially_refunded');--> statement-breakpoint
CREATE TABLE "payment_webhook_events" (
	"id" uuid PRIMARY KEY NOT NULL,
	"provider" "payment_provider" NOT NULL,
	"event_id" varchar(255) NOT NULL,
	"event_type" varchar(100) NOT NULL,
	"payload_hash" varchar(64),
	"processed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payments" (
	"id" uuid PRIMARY KEY NOT NULL,
	"order_id" uuid NOT NULL,
	"customer_id" uuid,
	"provider" "payment_provider" NOT NULL,
	"status" "payment_txn_status" DEFAULT 'pending' NOT NULL,
	"amount" integer NOT NULL,
	"currency" varchar(3) DEFAULT 'USD' NOT NULL,
	"transaction_id" varchar(255),
	"idempotency_key" varchar(128),
	"failure_code" varchar(100),
	"failure_reason" text,
	"provider_refund_id" varchar(255),
	"refunded_amount" integer DEFAULT 0 NOT NULL,
	"paid_at" timestamp with time zone,
	"metadata" jsonb,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "payment_webhook_provider_event_idx" ON "payment_webhook_events" USING btree ("provider","event_id");--> statement-breakpoint
CREATE INDEX "payments_order_id_idx" ON "payments" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "payments_transaction_id_idx" ON "payments" USING btree ("transaction_id");--> statement-breakpoint
CREATE INDEX "payments_status_idx" ON "payments" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "payments_order_active_idx" ON "payments" USING btree ("order_id") WHERE status IN ('pending', 'processing', 'completed');