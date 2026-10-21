CREATE INDEX "order_items_order_product_idx" ON "order_items" USING btree ("order_id","product_id");--> statement-breakpoint
CREATE INDEX "orders_created_at_status_idx" ON "orders" USING btree ("created_at","status");--> statement-breakpoint
CREATE INDEX "payments_status_paid_at_idx" ON "payments" USING btree ("status","paid_at");