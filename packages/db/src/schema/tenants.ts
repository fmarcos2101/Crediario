import {
  boolean,
  index,
  numeric,
  pgEnum,
  pgTable,
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

export const tenants = pgTable('tenants', {
  id: uuid('id').primaryKey(),
  name: varchar('name', { length: 160 }).notNull(),
  status: tenantStatusEnum('status').notNull().default('pending_setup'),
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
