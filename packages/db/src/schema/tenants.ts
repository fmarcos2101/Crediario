import {
  boolean,
  index,
  integer,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import { users } from './auth';

export const tenantStatusEnum = pgEnum('tenant_status', [
  'pending_setup',
  'pending_activation',
  'active',
  'suspended',
  'archived',
]);

export const tenantUserStatusEnum = pgEnum('tenant_user_status', [
  'invited',
  'pending_activation',
  'active',
  'revoked',
]);

export const lateFineTypeEnum = pgEnum('late_fine_type', ['fixed', 'percent']);

export const paymentProviderEnum = pgEnum('payment_provider', [
  'none',
  'pix_manual',
  'asaas',
  'mercadopago',
  'other',
]);

export const customerStatusEnum = pgEnum('customer_status', ['active', 'archived']);

export const tenants = pgTable('tenants', {
  id: uuid('id').primaryKey(),
  name: varchar('name', { length: 160 }).notNull(),
  status: tenantStatusEnum('status').notNull().default('pending_setup'),
  customerCount: integer('customer_count').notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const tenantSettings = pgTable('tenant_settings', {
  tenantId: uuid('tenant_id')
    .primaryKey()
    .references(() => tenants.id),
  timezone: varchar('timezone', { length: 64 }).notNull().default('America/Sao_Paulo'),
  locale: varchar('locale', { length: 16 }).notNull().default('pt-BR'),
  lateInterestEnabled: boolean('late_interest_enabled').notNull().default(false),
  lateInterestMonthlyRate: numeric('late_interest_monthly_rate', {
    precision: 7,
    scale: 4,
  }),
  lateFineEnabled: boolean('late_fine_enabled').notNull().default(false),
  lateFineType: lateFineTypeEnum('late_fine_type'),
  lateFineValue: numeric('late_fine_value', { precision: 14, scale: 2 }),
  signatureOtpOnDevice: boolean('signature_otp_on_device').notNull().default(false),
  signatureOtpQr: boolean('signature_otp_qr').notNull().default(true),
  reminderDaysBeforeDue: integer('reminder_days_before_due').notNull().default(3),
  overdueNudgeDays: integer('overdue_nudge_days').notNull().default(1),
  protestWarningDays: integer('protest_warning_days').notNull().default(15),
  collectionResponseHours: integer('collection_response_hours').notNull().default(24),
  msgDueReminderEnabled: boolean('msg_due_reminder_enabled').notNull().default(true),
  msgDueReminderBody: varchar('msg_due_reminder_body', { length: 2000 })
    .notNull()
    .default('Olá {nome}, sua parcela vence em {data}. Qualquer dúvida, fale conosco.'),
  msgOverdueEnabled: boolean('msg_overdue_enabled').notNull().default(true),
  msgOverdueBody: varchar('msg_overdue_body', { length: 2000 })
    .notNull()
    .default(
      'Olá {nome}, sua parcela venceu em {data}. Regularize para evitar encargos.',
    ),
  msgProtestWarningEnabled: boolean('msg_protest_warning_enabled')
    .notNull()
    .default(true),
  msgProtestWarningBody: varchar('msg_protest_warning_body', { length: 2000 })
    .notNull()
    .default(
      'Olá {nome}, o título da parcela vencida em {data} poderá ser protestado. Entre em contato para regularizar.',
    ),
  msgPaymentReceivedEnabled: boolean('msg_payment_received_enabled')
    .notNull()
    .default(true),
  msgPaymentReceivedBody: varchar('msg_payment_received_body', { length: 2000 })
    .notNull()
    .default('Olá {nome}, recebemos seu pagamento. Obrigado.'),
  paymentProvider: paymentProviderEnum('payment_provider').notNull().default('none'),
  paymentConfigured: boolean('payment_configured').notNull().default(false),
  metaPhoneNumberId: varchar('meta_phone_number_id', { length: 64 }),
  metaWabaId: varchar('meta_waba_id', { length: 64 }),
  metaConfigured: boolean('meta_configured').notNull().default(false),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const tenantUsers = pgTable(
  'tenant_users',
  {
    id: uuid('id').primaryKey(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id),
    role: varchar('role', { length: 32 }).notNull().default('OWNER'),
    status: tenantUserStatusEnum('status').notNull().default('invited'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('tenant_users_tenant_user_uidx').on(table.tenantId, table.userId),
    index('tenant_users_user_id_idx').on(table.userId),
  ],
);

export const tenantInvites = pgTable(
  'tenant_invites',
  {
    id: uuid('id').primaryKey(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id),
    email: varchar('email', { length: 320 }).notNull(),
    tokenHash: varchar('token_hash', { length: 64 }).notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    consumedAt: timestamp('consumed_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('tenant_invites_token_hash_uidx').on(table.tokenHash),
    index('tenant_invites_tenant_id_idx').on(table.tenantId),
  ],
);

export const tenantSecrets = pgTable('tenant_secrets', {
  tenantId: uuid('tenant_id')
    .primaryKey()
    .references(() => tenants.id),
  paymentApiKeyCiphertext: text('payment_api_key_ciphertext'),
  paymentWebhookSecretCiphertext: text('payment_webhook_secret_ciphertext'),
  metaAccessTokenCiphertext: text('meta_access_token_ciphertext'),
  metaAppSecretCiphertext: text('meta_app_secret_ciphertext'),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const customers = pgTable(
  'customers',
  {
    id: uuid('id').primaryKey(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id),
    name: varchar('name', { length: 160 }).notNull(),
    phone: varchar('phone', { length: 32 }),
    email: varchar('email', { length: 320 }),
    cpfHmac: varchar('cpf_hmac', { length: 64 }).notNull(),
    cpfCiphertext: text('cpf_ciphertext').notNull(),
    notes: varchar('notes', { length: 500 }),
    status: customerStatusEnum('status').notNull().default('active'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('customers_tenant_cpf_hmac_uidx').on(table.tenantId, table.cpfHmac),
    index('customers_tenant_name_idx').on(table.tenantId, table.name),
    index('customers_tenant_status_idx').on(table.tenantId, table.status),
  ],
);
