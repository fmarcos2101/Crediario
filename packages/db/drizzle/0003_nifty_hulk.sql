CREATE TYPE "public"."customer_status" AS ENUM('active', 'archived');--> statement-breakpoint
CREATE TYPE "public"."payment_provider" AS ENUM('none', 'pix_manual', 'asaas', 'mercadopago', 'other');--> statement-breakpoint
CREATE TABLE "customers" (
	"id" uuid PRIMARY KEY NOT NULL,
	"tenant_id" uuid NOT NULL,
	"name" varchar(160) NOT NULL,
	"phone" varchar(32),
	"email" varchar(320),
	"cpf_hmac" varchar(64) NOT NULL,
	"cpf_ciphertext" text NOT NULL,
	"notes" varchar(500),
	"status" "customer_status" DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tenant_secrets" (
	"tenant_id" uuid PRIMARY KEY NOT NULL,
	"payment_api_key_ciphertext" text,
	"payment_webhook_secret_ciphertext" text,
	"meta_access_token_ciphertext" text,
	"meta_app_secret_ciphertext" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "tenant_settings" ADD COLUMN "reminder_days_before_due" integer DEFAULT 3 NOT NULL;--> statement-breakpoint
ALTER TABLE "tenant_settings" ADD COLUMN "overdue_nudge_days" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "tenant_settings" ADD COLUMN "protest_warning_days" integer DEFAULT 15 NOT NULL;--> statement-breakpoint
ALTER TABLE "tenant_settings" ADD COLUMN "collection_response_hours" integer DEFAULT 24 NOT NULL;--> statement-breakpoint
ALTER TABLE "tenant_settings" ADD COLUMN "msg_due_reminder_enabled" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "tenant_settings" ADD COLUMN "msg_due_reminder_body" varchar(2000) DEFAULT 'Olá {nome}, sua parcela vence em {data}. Qualquer dúvida, fale conosco.' NOT NULL;--> statement-breakpoint
ALTER TABLE "tenant_settings" ADD COLUMN "msg_overdue_enabled" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "tenant_settings" ADD COLUMN "msg_overdue_body" varchar(2000) DEFAULT 'Olá {nome}, sua parcela venceu em {data}. Regularize para evitar encargos.' NOT NULL;--> statement-breakpoint
ALTER TABLE "tenant_settings" ADD COLUMN "msg_protest_warning_enabled" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "tenant_settings" ADD COLUMN "msg_protest_warning_body" varchar(2000) DEFAULT 'Olá {nome}, o título da parcela vencida em {data} poderá ser protestado. Entre em contato para regularizar.' NOT NULL;--> statement-breakpoint
ALTER TABLE "tenant_settings" ADD COLUMN "msg_payment_received_enabled" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "tenant_settings" ADD COLUMN "msg_payment_received_body" varchar(2000) DEFAULT 'Olá {nome}, recebemos seu pagamento. Obrigado.' NOT NULL;--> statement-breakpoint
ALTER TABLE "tenant_settings" ADD COLUMN "payment_provider" "payment_provider" DEFAULT 'none' NOT NULL;--> statement-breakpoint
ALTER TABLE "tenant_settings" ADD COLUMN "payment_configured" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "tenant_settings" ADD COLUMN "meta_phone_number_id" varchar(64);--> statement-breakpoint
ALTER TABLE "tenant_settings" ADD COLUMN "meta_waba_id" varchar(64);--> statement-breakpoint
ALTER TABLE "tenant_settings" ADD COLUMN "meta_configured" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "tenants" ADD COLUMN "customer_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "customers" ADD CONSTRAINT "customers_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tenant_secrets" ADD CONSTRAINT "tenant_secrets_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "customers_tenant_cpf_hmac_uidx" ON "customers" USING btree ("tenant_id","cpf_hmac");--> statement-breakpoint
CREATE INDEX "customers_tenant_name_idx" ON "customers" USING btree ("tenant_id","name");--> statement-breakpoint
CREATE INDEX "customers_tenant_status_idx" ON "customers" USING btree ("tenant_id","status");
--> statement-breakpoint
ALTER TABLE "customers" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "customers" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "tenant_secrets" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "tenant_secrets" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "customers_by_tenant" ON "customers"
  USING (tenant_id = nullif(current_setting('app.current_tenant_id', true), '')::uuid)
  WITH CHECK (tenant_id = nullif(current_setting('app.current_tenant_id', true), '')::uuid);
--> statement-breakpoint
CREATE POLICY "tenant_secrets_by_tenant" ON "tenant_secrets"
  USING (tenant_id = nullif(current_setting('app.current_tenant_id', true), '')::uuid)
  WITH CHECK (tenant_id = nullif(current_setting('app.current_tenant_id', true), '')::uuid);
--> statement-breakpoint
CREATE OR REPLACE FUNCTION public.sync_tenant_customer_count()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE tenants
  SET
    customer_count = (
      SELECT count(*)::int FROM customers c
      WHERE c.tenant_id = COALESCE(NEW.tenant_id, OLD.tenant_id)
        AND c.status = 'active'
    ),
    updated_at = now()
  WHERE id = COALESCE(NEW.tenant_id, OLD.tenant_id);
  RETURN COALESCE(NEW, OLD);
END;
$$;
--> statement-breakpoint
CREATE TRIGGER customers_sync_count
AFTER INSERT OR UPDATE ON customers
FOR EACH ROW EXECUTE FUNCTION public.sync_tenant_customer_count();
--> statement-breakpoint
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'crediplus_app') THEN
    GRANT SELECT, INSERT, UPDATE ON ALL TABLES IN SCHEMA public TO crediplus_app;
    GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO crediplus_app;
  END IF;
END
$$;
