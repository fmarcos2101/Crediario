CREATE TYPE "public"."collection_channel" AS ENUM('email', 'none');--> statement-breakpoint
CREATE TYPE "public"."collection_kind" AS ENUM('due_reminder', 'overdue', 'protest_warning', 'payment_received');--> statement-breakpoint
CREATE TYPE "public"."collection_message_status" AS ENUM('sent', 'skipped_no_channel', 'skipped_disabled');--> statement-breakpoint
CREATE TYPE "public"."payment_webhook_status" AS ENUM('applied', 'duplicate', 'ignored', 'failed');--> statement-breakpoint
CREATE TABLE "collection_messages" (
	"id" uuid PRIMARY KEY NOT NULL,
	"tenant_id" uuid NOT NULL,
	"sale_id" uuid NOT NULL,
	"installment_id" uuid NOT NULL,
	"payment_id" uuid,
	"kind" "collection_kind" NOT NULL,
	"channel" "collection_channel" NOT NULL,
	"status" "collection_message_status" NOT NULL,
	"occurrence_key" varchar(200) NOT NULL,
	"recipient" varchar(320),
	"body" varchar(2000) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "installment_status_history" (
	"id" uuid PRIMARY KEY NOT NULL,
	"tenant_id" uuid NOT NULL,
	"sale_id" uuid NOT NULL,
	"installment_id" uuid NOT NULL,
	"from_status" "installment_status",
	"to_status" "installment_status" NOT NULL,
	"reason" varchar(64) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payment_webhook_events" (
	"id" uuid PRIMARY KEY NOT NULL,
	"tenant_id" uuid NOT NULL,
	"event_id" varchar(200) NOT NULL,
	"installment_id" uuid,
	"payment_id" uuid,
	"status" "payment_webhook_status" NOT NULL,
	"payload" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sale_status_history" (
	"id" uuid PRIMARY KEY NOT NULL,
	"tenant_id" uuid NOT NULL,
	"sale_id" uuid NOT NULL,
	"from_status" "sale_status",
	"to_status" "sale_status" NOT NULL,
	"reason" varchar(64) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "collection_messages" ADD CONSTRAINT "collection_messages_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "collection_messages" ADD CONSTRAINT "collection_messages_sale_id_sales_id_fk" FOREIGN KEY ("sale_id") REFERENCES "public"."sales"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "collection_messages" ADD CONSTRAINT "collection_messages_installment_id_installments_id_fk" FOREIGN KEY ("installment_id") REFERENCES "public"."installments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "collection_messages" ADD CONSTRAINT "collection_messages_payment_id_payments_id_fk" FOREIGN KEY ("payment_id") REFERENCES "public"."payments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "collection_messages" ADD CONSTRAINT "collection_messages_sale_tenant_fk" FOREIGN KEY ("tenant_id","sale_id") REFERENCES "public"."sales"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "collection_messages" ADD CONSTRAINT "collection_messages_installment_tenant_fk" FOREIGN KEY ("tenant_id","installment_id") REFERENCES "public"."installments"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "installment_status_history" ADD CONSTRAINT "installment_status_history_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "installment_status_history" ADD CONSTRAINT "installment_status_history_sale_id_sales_id_fk" FOREIGN KEY ("sale_id") REFERENCES "public"."sales"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "installment_status_history" ADD CONSTRAINT "installment_status_history_installment_id_installments_id_fk" FOREIGN KEY ("installment_id") REFERENCES "public"."installments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "installment_status_history" ADD CONSTRAINT "installment_status_history_sale_tenant_fk" FOREIGN KEY ("tenant_id","sale_id") REFERENCES "public"."sales"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "installment_status_history" ADD CONSTRAINT "installment_status_history_installment_tenant_fk" FOREIGN KEY ("tenant_id","installment_id") REFERENCES "public"."installments"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_webhook_events" ADD CONSTRAINT "payment_webhook_events_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_webhook_events" ADD CONSTRAINT "payment_webhook_events_payment_id_payments_id_fk" FOREIGN KEY ("payment_id") REFERENCES "public"."payments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sale_status_history" ADD CONSTRAINT "sale_status_history_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sale_status_history" ADD CONSTRAINT "sale_status_history_sale_id_sales_id_fk" FOREIGN KEY ("sale_id") REFERENCES "public"."sales"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sale_status_history" ADD CONSTRAINT "sale_status_history_sale_tenant_fk" FOREIGN KEY ("tenant_id","sale_id") REFERENCES "public"."sales"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "collection_messages_tenant_occurrence_uidx" ON "collection_messages" USING btree ("tenant_id","occurrence_key");--> statement-breakpoint
CREATE INDEX "collection_messages_tenant_sale_idx" ON "collection_messages" USING btree ("tenant_id","sale_id");--> statement-breakpoint
CREATE INDEX "collection_messages_tenant_created_idx" ON "collection_messages" USING btree ("tenant_id","created_at");--> statement-breakpoint
CREATE INDEX "installment_status_history_tenant_sale_idx" ON "installment_status_history" USING btree ("tenant_id","sale_id");--> statement-breakpoint
CREATE UNIQUE INDEX "payment_webhook_events_tenant_event_uidx" ON "payment_webhook_events" USING btree ("tenant_id","event_id");--> statement-breakpoint
CREATE INDEX "payment_webhook_events_tenant_created_idx" ON "payment_webhook_events" USING btree ("tenant_id","created_at");--> statement-breakpoint
CREATE INDEX "sale_status_history_tenant_sale_idx" ON "sale_status_history" USING btree ("tenant_id","sale_id");
--> statement-breakpoint
ALTER TABLE "sale_status_history" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "sale_status_history" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "installment_status_history" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "installment_status_history" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "collection_messages" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "collection_messages" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "payment_webhook_events" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "payment_webhook_events" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "sale_status_history_by_tenant" ON "sale_status_history"
  USING (tenant_id = nullif(current_setting('app.current_tenant_id', true), '')::uuid)
  WITH CHECK (tenant_id = nullif(current_setting('app.current_tenant_id', true), '')::uuid);
--> statement-breakpoint
CREATE POLICY "installment_status_history_by_tenant" ON "installment_status_history"
  USING (tenant_id = nullif(current_setting('app.current_tenant_id', true), '')::uuid)
  WITH CHECK (tenant_id = nullif(current_setting('app.current_tenant_id', true), '')::uuid);
--> statement-breakpoint
CREATE POLICY "collection_messages_by_tenant" ON "collection_messages"
  USING (tenant_id = nullif(current_setting('app.current_tenant_id', true), '')::uuid)
  WITH CHECK (tenant_id = nullif(current_setting('app.current_tenant_id', true), '')::uuid);
--> statement-breakpoint
CREATE POLICY "payment_webhook_events_by_tenant" ON "payment_webhook_events"
  USING (tenant_id = nullif(current_setting('app.current_tenant_id', true), '')::uuid)
  WITH CHECK (tenant_id = nullif(current_setting('app.current_tenant_id', true), '')::uuid);
--> statement-breakpoint
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'crediplus_app') THEN
    GRANT SELECT, INSERT, UPDATE ON ALL TABLES IN SCHEMA public TO crediplus_app;
    GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO crediplus_app;
  END IF;
END
$$;