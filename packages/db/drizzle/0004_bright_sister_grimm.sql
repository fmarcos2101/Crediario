CREATE TYPE "public"."installment_frequency" AS ENUM('monthly', 'weekly', 'biweekly');--> statement-breakpoint
CREATE TYPE "public"."installment_status" AS ENUM('OPEN', 'DUE_SOON', 'OVERDUE', 'PARTIALLY_PAID', 'PAID', 'RENEGOTIATED', 'CANCELLED');--> statement-breakpoint
CREATE TYPE "public"."payment_method" AS ENUM('PIX', 'CASH', 'CARD', 'TRANSFER', 'BOLETO', 'OTHER');--> statement-breakpoint
CREATE TYPE "public"."sale_status" AS ENUM('open', 'cancelled');--> statement-breakpoint
CREATE TABLE "installments" (
	"id" uuid PRIMARY KEY NOT NULL,
	"tenant_id" uuid NOT NULL,
	"sale_id" uuid NOT NULL,
	"sequence" integer NOT NULL,
	"due_date" date NOT NULL,
	"amount" numeric(14, 2) NOT NULL,
	"paid_amount" numeric(14, 2) DEFAULT '0.00' NOT NULL,
	"status" "installment_status" DEFAULT 'OPEN' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "installments_amounts_chk" CHECK (sequence >= 1 AND amount > 0 AND paid_amount >= 0 AND paid_amount <= amount)
);
--> statement-breakpoint
CREATE TABLE "payment_reversals" (
	"id" uuid PRIMARY KEY NOT NULL,
	"tenant_id" uuid NOT NULL,
	"payment_id" uuid NOT NULL,
	"amount" numeric(14, 2) NOT NULL,
	"reason" varchar(500) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "payment_reversals_amount_chk" CHECK (amount > 0)
);
--> statement-breakpoint
CREATE TABLE "payments" (
	"id" uuid PRIMARY KEY NOT NULL,
	"tenant_id" uuid NOT NULL,
	"sale_id" uuid NOT NULL,
	"installment_id" uuid NOT NULL,
	"amount" numeric(14, 2) NOT NULL,
	"reversed_amount" numeric(14, 2) DEFAULT '0.00' NOT NULL,
	"method" "payment_method" NOT NULL,
	"paid_at" timestamp with time zone NOT NULL,
	"notes" varchar(500),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "payments_amounts_chk" CHECK (amount > 0 AND reversed_amount >= 0 AND reversed_amount <= amount)
);
--> statement-breakpoint
CREATE TABLE "sale_items" (
	"id" uuid PRIMARY KEY NOT NULL,
	"tenant_id" uuid NOT NULL,
	"sale_id" uuid NOT NULL,
	"description" varchar(200) NOT NULL,
	"quantity" integer NOT NULL,
	"unit_price" numeric(14, 2) NOT NULL,
	"line_total" numeric(14, 2) NOT NULL,
	CONSTRAINT "sale_items_amounts_chk" CHECK (quantity >= 1 AND unit_price >= 0 AND line_total = unit_price * quantity)
);
--> statement-breakpoint
CREATE TABLE "sales" (
	"id" uuid PRIMARY KEY NOT NULL,
	"tenant_id" uuid NOT NULL,
	"customer_id" uuid NOT NULL,
	"status" "sale_status" DEFAULT 'open' NOT NULL,
	"notes" varchar(500),
	"total_amount" numeric(14, 2) NOT NULL,
	"down_payment" numeric(14, 2) NOT NULL,
	"financed_amount" numeric(14, 2) NOT NULL,
	"installment_count" integer NOT NULL,
	"frequency" "installment_frequency" DEFAULT 'monthly' NOT NULL,
	"first_due_date" date NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sales_amounts_chk" CHECK (total_amount > 0 AND down_payment >= 0 AND down_payment < total_amount AND financed_amount = total_amount - down_payment AND installment_count >= 1)
);
--> statement-breakpoint
ALTER TABLE "tenants" ADD COLUMN "sale_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "customers_tenant_id_uidx" ON "customers" USING btree ("tenant_id","id");--> statement-breakpoint
CREATE UNIQUE INDEX "sales_tenant_id_uidx" ON "sales" USING btree ("tenant_id","id");--> statement-breakpoint
CREATE UNIQUE INDEX "installments_tenant_id_uidx" ON "installments" USING btree ("tenant_id","id");--> statement-breakpoint
CREATE UNIQUE INDEX "payments_tenant_id_uidx" ON "payments" USING btree ("tenant_id","id");--> statement-breakpoint
ALTER TABLE "installments" ADD CONSTRAINT "installments_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "installments" ADD CONSTRAINT "installments_sale_id_sales_id_fk" FOREIGN KEY ("sale_id") REFERENCES "public"."sales"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "installments" ADD CONSTRAINT "installments_sale_tenant_fk" FOREIGN KEY ("tenant_id","sale_id") REFERENCES "public"."sales"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_reversals" ADD CONSTRAINT "payment_reversals_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_reversals" ADD CONSTRAINT "payment_reversals_payment_id_payments_id_fk" FOREIGN KEY ("payment_id") REFERENCES "public"."payments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_reversals" ADD CONSTRAINT "payment_reversals_payment_tenant_fk" FOREIGN KEY ("tenant_id","payment_id") REFERENCES "public"."payments"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_sale_id_sales_id_fk" FOREIGN KEY ("sale_id") REFERENCES "public"."sales"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_installment_id_installments_id_fk" FOREIGN KEY ("installment_id") REFERENCES "public"."installments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_sale_tenant_fk" FOREIGN KEY ("tenant_id","sale_id") REFERENCES "public"."sales"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_installment_tenant_fk" FOREIGN KEY ("tenant_id","installment_id") REFERENCES "public"."installments"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sale_items" ADD CONSTRAINT "sale_items_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sale_items" ADD CONSTRAINT "sale_items_sale_id_sales_id_fk" FOREIGN KEY ("sale_id") REFERENCES "public"."sales"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sale_items" ADD CONSTRAINT "sale_items_sale_tenant_fk" FOREIGN KEY ("tenant_id","sale_id") REFERENCES "public"."sales"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales" ADD CONSTRAINT "sales_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales" ADD CONSTRAINT "sales_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales" ADD CONSTRAINT "sales_customer_tenant_fk" FOREIGN KEY ("tenant_id","customer_id") REFERENCES "public"."customers"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "installments_sale_sequence_uidx" ON "installments" USING btree ("sale_id","sequence");--> statement-breakpoint
CREATE INDEX "installments_tenant_due_idx" ON "installments" USING btree ("tenant_id","due_date");--> statement-breakpoint
CREATE INDEX "installments_tenant_status_idx" ON "installments" USING btree ("tenant_id","status");--> statement-breakpoint
CREATE INDEX "payment_reversals_tenant_payment_idx" ON "payment_reversals" USING btree ("tenant_id","payment_id");--> statement-breakpoint
CREATE INDEX "payments_tenant_installment_idx" ON "payments" USING btree ("tenant_id","installment_id");--> statement-breakpoint
CREATE INDEX "payments_tenant_sale_idx" ON "payments" USING btree ("tenant_id","sale_id");--> statement-breakpoint
CREATE INDEX "sale_items_tenant_sale_idx" ON "sale_items" USING btree ("tenant_id","sale_id");--> statement-breakpoint
CREATE INDEX "sales_tenant_created_idx" ON "sales" USING btree ("tenant_id","created_at");--> statement-breakpoint
CREATE INDEX "sales_tenant_customer_idx" ON "sales" USING btree ("tenant_id","customer_id");--> statement-breakpoint
CREATE INDEX "sales_tenant_status_idx" ON "sales" USING btree ("tenant_id","status");
--> statement-breakpoint
ALTER TABLE "sales" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "sales" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "sale_items" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "sale_items" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "installments" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "installments" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "payments" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "payments" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "payment_reversals" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "payment_reversals" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "sales_by_tenant" ON "sales"
  USING (tenant_id = nullif(current_setting('app.current_tenant_id', true), '')::uuid)
  WITH CHECK (tenant_id = nullif(current_setting('app.current_tenant_id', true), '')::uuid);
--> statement-breakpoint
CREATE POLICY "sale_items_by_tenant" ON "sale_items"
  USING (tenant_id = nullif(current_setting('app.current_tenant_id', true), '')::uuid)
  WITH CHECK (tenant_id = nullif(current_setting('app.current_tenant_id', true), '')::uuid);
--> statement-breakpoint
CREATE POLICY "installments_by_tenant" ON "installments"
  USING (tenant_id = nullif(current_setting('app.current_tenant_id', true), '')::uuid)
  WITH CHECK (tenant_id = nullif(current_setting('app.current_tenant_id', true), '')::uuid);
--> statement-breakpoint
CREATE POLICY "payments_by_tenant" ON "payments"
  USING (tenant_id = nullif(current_setting('app.current_tenant_id', true), '')::uuid)
  WITH CHECK (tenant_id = nullif(current_setting('app.current_tenant_id', true), '')::uuid);
--> statement-breakpoint
CREATE POLICY "payment_reversals_by_tenant" ON "payment_reversals"
  USING (tenant_id = nullif(current_setting('app.current_tenant_id', true), '')::uuid)
  WITH CHECK (tenant_id = nullif(current_setting('app.current_tenant_id', true), '')::uuid);
--> statement-breakpoint
CREATE OR REPLACE FUNCTION public.sync_tenant_sale_count()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE tenants
  SET
    sale_count = (
      SELECT count(*)::int FROM sales s
      WHERE s.tenant_id = COALESCE(NEW.tenant_id, OLD.tenant_id)
        AND s.status = 'open'
    ),
    updated_at = now()
  WHERE id = COALESCE(NEW.tenant_id, OLD.tenant_id);
  RETURN COALESCE(NEW, OLD);
END;
$$;
--> statement-breakpoint
CREATE TRIGGER sales_sync_count
AFTER INSERT OR UPDATE ON sales
FOR EACH ROW EXECUTE FUNCTION public.sync_tenant_sale_count();
--> statement-breakpoint
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'crediplus_app') THEN
    GRANT SELECT, INSERT, UPDATE ON ALL TABLES IN SCHEMA public TO crediplus_app;
    GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO crediplus_app;
  END IF;
END
$$;
