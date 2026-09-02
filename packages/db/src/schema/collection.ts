import {
  foreignKey,
  index,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import { installments, payments, sales } from './sales';
import { tenants } from './tenants';

export const collectionKindEnum = pgEnum('collection_kind', [
  'due_reminder',
  'overdue',
  'protest_warning',
  'payment_received',
]);

export const collectionChannelEnum = pgEnum('collection_channel', ['email', 'none']);

export const collectionMessageStatusEnum = pgEnum('collection_message_status', [
  'sent',
  'skipped_no_channel',
  'skipped_disabled',
]);

export const paymentWebhookStatusEnum = pgEnum('payment_webhook_status', [
  'applied',
  'duplicate',
  'ignored',
  'failed',
]);

export const collectionMessages = pgTable(
  'collection_messages',
  {
    id: uuid('id').primaryKey(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id),
    saleId: uuid('sale_id')
      .notNull()
      .references(() => sales.id),
    installmentId: uuid('installment_id')
      .notNull()
      .references(() => installments.id),
    paymentId: uuid('payment_id').references(() => payments.id),
    kind: collectionKindEnum('kind').notNull(),
    channel: collectionChannelEnum('channel').notNull(),
    status: collectionMessageStatusEnum('status').notNull(),
    occurrenceKey: varchar('occurrence_key', { length: 200 }).notNull(),
    recipient: varchar('recipient', { length: 320 }),
    body: varchar('body', { length: 2000 }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('collection_messages_tenant_occurrence_uidx').on(
      table.tenantId,
      table.occurrenceKey,
    ),
    index('collection_messages_tenant_sale_idx').on(table.tenantId, table.saleId),
    index('collection_messages_tenant_created_idx').on(table.tenantId, table.createdAt),
    foreignKey({
      name: 'collection_messages_sale_tenant_fk',
      columns: [table.tenantId, table.saleId],
      foreignColumns: [sales.tenantId, sales.id],
    }),
    foreignKey({
      name: 'collection_messages_installment_tenant_fk',
      columns: [table.tenantId, table.installmentId],
      foreignColumns: [installments.tenantId, installments.id],
    }),
  ],
);

export const paymentWebhookEvents = pgTable(
  'payment_webhook_events',
  {
    id: uuid('id').primaryKey(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id),
    eventId: varchar('event_id', { length: 200 }).notNull(),
    installmentId: uuid('installment_id'),
    paymentId: uuid('payment_id').references(() => payments.id),
    status: paymentWebhookStatusEnum('status').notNull(),
    payload: text('payload').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('payment_webhook_events_tenant_event_uidx').on(
      table.tenantId,
      table.eventId,
    ),
    index('payment_webhook_events_tenant_created_idx').on(
      table.tenantId,
      table.createdAt,
    ),
  ],
);
