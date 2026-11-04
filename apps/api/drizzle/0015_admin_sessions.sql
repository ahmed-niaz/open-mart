CREATE TABLE "admin_sessions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "admin_id" uuid NOT NULL,
  "token_hash" text NOT NULL,
  "device_info" text,
  "ip_address" varchar(45),
  "expires_at" timestamp with time zone NOT NULL,
  "revoked_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "admin_sessions_admin_id_fkey" FOREIGN KEY ("admin_id") REFERENCES "admin_users"("id") ON DELETE CASCADE
);--> statement-breakpoint
CREATE INDEX "admin_sessions_admin_id_revoked_at_idx" ON "admin_sessions" USING btree ("admin_id","revoked_at");--> statement-breakpoint
CREATE INDEX "admin_sessions_token_hash_idx" ON "admin_sessions" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "admin_sessions_expires_at_idx" ON "admin_sessions" USING btree ("expires_at");
