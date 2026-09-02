CREATE TYPE "public"."late_fine_type" AS ENUM('fixed', 'percent');--> statement-breakpoint
CREATE TYPE "public"."tenant_status" AS ENUM('pending_setup', 'pending_activation', 'active', 'suspended', 'archived');--> statement-breakpoint
CREATE TYPE "public"."tenant_user_status" AS ENUM('invited', 'pending_activation', 'active', 'revoked');--> statement-breakpoint
CREATE TABLE "tenant_invites" (
	"id" uuid PRIMARY KEY NOT NULL,
	"tenant_id" uuid NOT NULL,
	"email" varchar(320) NOT NULL,
	"token_hash" varchar(64) NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"consumed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tenant_settings" (
	"tenant_id" uuid PRIMARY KEY NOT NULL,
	"timezone" varchar(64) DEFAULT 'America/Sao_Paulo' NOT NULL,
	"locale" varchar(16) DEFAULT 'pt-BR' NOT NULL,
	"late_interest_enabled" boolean DEFAULT false NOT NULL,
	"late_interest_monthly_rate" numeric(7, 4),
	"late_fine_enabled" boolean DEFAULT false NOT NULL,
	"late_fine_type" "late_fine_type",
	"late_fine_value" numeric(14, 2),
	"signature_otp_on_device" boolean DEFAULT false NOT NULL,
	"signature_otp_qr" boolean DEFAULT true NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tenant_users" (
	"id" uuid PRIMARY KEY NOT NULL,
	"tenant_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"role" varchar(32) DEFAULT 'OWNER' NOT NULL,
	"status" "tenant_user_status" DEFAULT 'invited' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tenants" (
	"id" uuid PRIMARY KEY NOT NULL,
	"name" varchar(160) NOT NULL,
	"status" "tenant_status" DEFAULT 'pending_setup' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "sessions" ADD COLUMN "tenant_id" uuid;--> statement-breakpoint
ALTER TABLE "tenant_invites" ADD CONSTRAINT "tenant_invites_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tenant_settings" ADD CONSTRAINT "tenant_settings_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tenant_users" ADD CONSTRAINT "tenant_users_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tenant_users" ADD CONSTRAINT "tenant_users_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "tenant_invites_token_hash_uidx" ON "tenant_invites" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "tenant_invites_tenant_id_idx" ON "tenant_invites" USING btree ("tenant_id");--> statement-breakpoint
CREATE UNIQUE INDEX "tenant_users_tenant_user_uidx" ON "tenant_users" USING btree ("tenant_id","user_id");--> statement-breakpoint
CREATE INDEX "tenant_users_user_id_idx" ON "tenant_users" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "sessions_tenant_id_idx" ON "sessions" USING btree ("tenant_id");
--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "tenants" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "tenants" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "tenant_settings" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "tenant_settings" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "tenant_users" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "tenant_users" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "tenant_invites" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "tenant_invites" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "tenants_by_id" ON "tenants"
  FOR SELECT
  USING (id = nullif(current_setting('app.current_tenant_id', true), '')::uuid);
--> statement-breakpoint
CREATE POLICY "tenants_superadmin" ON "tenants"
  USING (current_setting('app.is_super_admin', true) = 'true')
  WITH CHECK (current_setting('app.is_super_admin', true) = 'true');
--> statement-breakpoint
CREATE POLICY "tenants_member_read" ON "tenants"
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM tenant_users tu
      WHERE tu.tenant_id = tenants.id
        AND tu.user_id = nullif(current_setting('app.current_user_id', true), '')::uuid
    )
  );
--> statement-breakpoint
CREATE POLICY "tenant_settings_by_tenant" ON "tenant_settings"
  USING (tenant_id = nullif(current_setting('app.current_tenant_id', true), '')::uuid)
  WITH CHECK (tenant_id = nullif(current_setting('app.current_tenant_id', true), '')::uuid);
--> statement-breakpoint
CREATE POLICY "tenant_settings_superadmin_read" ON "tenant_settings"
  FOR SELECT
  USING (current_setting('app.is_super_admin', true) = 'true');
--> statement-breakpoint
CREATE POLICY "tenant_users_by_tenant" ON "tenant_users"
  USING (tenant_id = nullif(current_setting('app.current_tenant_id', true), '')::uuid)
  WITH CHECK (tenant_id = nullif(current_setting('app.current_tenant_id', true), '')::uuid);
--> statement-breakpoint
CREATE POLICY "tenant_users_by_user" ON "tenant_users"
  FOR SELECT
  USING (user_id = nullif(current_setting('app.current_user_id', true), '')::uuid);
--> statement-breakpoint
CREATE POLICY "tenant_users_superadmin_read" ON "tenant_users"
  FOR SELECT
  USING (current_setting('app.is_super_admin', true) = 'true');
--> statement-breakpoint
CREATE POLICY "tenant_invites_by_tenant" ON "tenant_invites"
  USING (tenant_id = nullif(current_setting('app.current_tenant_id', true), '')::uuid)
  WITH CHECK (tenant_id = nullif(current_setting('app.current_tenant_id', true), '')::uuid);
--> statement-breakpoint
CREATE POLICY "tenant_invites_by_token" ON "tenant_invites"
  FOR SELECT
  USING (token_hash = nullif(current_setting('app.invite_token_hash', true), ''));
--> statement-breakpoint
CREATE POLICY "tenant_invites_superadmin" ON "tenant_invites"
  USING (current_setting('app.is_super_admin', true) = 'true')
  WITH CHECK (current_setting('app.is_super_admin', true) = 'true');
--> statement-breakpoint
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'crediplus_app') THEN
    GRANT USAGE ON SCHEMA public TO crediplus_app;
    GRANT SELECT, INSERT, UPDATE ON ALL TABLES IN SCHEMA public TO crediplus_app;
    GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO crediplus_app;
  END IF;
END
$$;

