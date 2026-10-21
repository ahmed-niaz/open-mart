CREATE TABLE "outbox_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"aggregate_type" varchar(50) NOT NULL,
	"aggregate_id" varchar(100) NOT NULL,
	"event_type" varchar(100) NOT NULL,
	"payload" jsonb NOT NULL,
	"status" varchar(20) DEFAULT 'pending' NOT NULL,
	"retry_count" integer DEFAULT 0 NOT NULL,
	"last_error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"published_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "processed_events" (
	"event_id" uuid NOT NULL,
	"handler_name" varchar(100) NOT NULL,
	"processed_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "processed_events_event_id_handler_name_pk" PRIMARY KEY("event_id","handler_name")
);
--> statement-breakpoint
CREATE TABLE "idempotency_keys" (
	"key" varchar(128) NOT NULL,
	"scope" varchar(100) NOT NULL,
	"request_path" varchar(255) NOT NULL,
	"request_hash" varchar(64) NOT NULL,
	"status" varchar(20) DEFAULT 'in_progress' NOT NULL,
	"response_code" integer,
	"response_body" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	CONSTRAINT "idempotency_keys_key_scope_request_path_pk" PRIMARY KEY("key","scope","request_path")
);
--> statement-breakpoint
CREATE INDEX "idx_outbox_pending" ON "outbox_messages" USING btree ("status","created_at");--> statement-breakpoint
CREATE INDEX "idx_outbox_aggregate" ON "outbox_messages" USING btree ("aggregate_type","aggregate_id");--> statement-breakpoint
CREATE INDEX "idx_processed_events_at" ON "processed_events" USING btree ("processed_at");--> statement-breakpoint
CREATE INDEX "idx_idempotency_expires" ON "idempotency_keys" USING btree ("expires_at");