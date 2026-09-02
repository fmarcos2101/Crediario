import { sql } from 'drizzle-orm';
import {
  check,
  date,
  foreignKey,
  index,
  integer,
  numeric,
  pgEnum,
  pgTable,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import { customers, tenants } from './tenants';

export const saleStatusEnum = pgEnum('sale_status', ['open', 'cancelled']);

export const installmentFrequencyEnum = pgEnum('installment_frequency', [
  'monthly',
  'weekly',
  'biweekly',
]);

export const installmentStatusEnum = pgEnum('installment_status', [
  'OPEN',
  'DUE_SOON',
  'OVERDUE',
  'PARTIALLY_PAID',
  'PAID',
  'RENEGOTIATED',
  'CANCELLED',
]);

export const paymentMethodEnum = pgEnum('payment_method', [
  'PIX',
  'CASH',
  'CARD',
  'TRANSFER',
  'BOLETO',
  'OTHER',
]);

export const sales = pgTable(
  'sales',
  {
    id: uuid('id').primaryKey(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id),
    customerId: uuid('customer_id')
      .notNull()
      .references(() => customers.id),
    status: saleStatusEnum('status').notNull().default('open'),
    notes: varchar('notes', { length: 500 }),
    totalAmount: numeric('total_amount', { precision: 14, scale: 2 }).notNull(),
    downPayment: numeric('down_payment', { precision: 14, scale: 2 }).notNull(),
    financedAmount: numeric('financed_amount', { precision: 14, scale: 2 }).notNull(),
    installmentCount: integer('installment_count').notNull(),
    frequency: installmentFrequencyEnum('frequency').notNull().default('monthly'),
    firstDueDate: date('first_due_date').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('sales_tenant_id_uidx').on(table.tenantId, table.id),
    index('sales_tenant_created_idx').on(table.tenantId, table.createdAt),
    index('sales_tenant_customer_idx').on(table.tenantId, table.customerId),
    index('sales_tenant_status_idx').on(table.tenantId, table.status),
    foreignKey({
      name: 'sales_customer_tenant_fk',
      columns: [table.tenantId, table.customerId],
      foreignColumns: [customers.tenantId, customers.id],
    }),
    check(
      'sales_amounts_chk',
      sql`total_amount > 0 AND down_payment >= 0 AND down_payment < total_amount AND financed_amount = total_amount - down_payment AND installment_count >= 1`,
    ),
  ],
);

export const saleItems = pgTable(
  'sale_items',
  {
    id: uuid('id').primaryKey(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id),
    saleId: uuid('sale_id')
      .notNull()
      .references(() => sales.id),
    description: varchar('description', { length: 200 }).notNull(),
    quantity: integer('quantity').notNull(),
    unitPrice: numeric('unit_price', { precision: 14, scale: 2 }).notNull(),
    lineTotal: numeric('line_total', { precision: 14, scale: 2 }).notNull(),
  },
  (table) => [
    index('sale_items_tenant_sale_idx').on(table.tenantId, table.saleId),
    foreignKey({
      name: 'sale_items_sale_tenant_fk',
      columns: [table.tenantId, table.saleId],
      foreignColumns: [sales.tenantId, sales.id],
    }),
    check(
      'sale_items_amounts_chk',
      sql`quantity >= 1 AND unit_price >= 0 AND line_total = unit_price * quantity`,
    ),
  ],
);

export const installments = pgTable(
  'installments',
  {
    id: uuid('id').primaryKey(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id),
    saleId: uuid('sale_id')
      .notNull()
      .references(() => sales.id),
    sequence: integer('sequence').notNull(),
    dueDate: date('due_date').notNull(),
    amount: numeric('amount', { precision: 14, scale: 2 }).notNull(),
    paidAmount: numeric('paid_amount', { precision: 14, scale: 2 })
      .notNull()
      .default('0.00'),
    status: installmentStatusEnum('status').notNull().default('OPEN'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('installments_tenant_id_uidx').on(table.tenantId, table.id),
    uniqueIndex('installments_sale_sequence_uidx').on(table.saleId, table.sequence),
    index('installments_tenant_due_idx').on(table.tenantId, table.dueDate),
    index('installments_tenant_status_idx').on(table.tenantId, table.status),
    foreignKey({
      name: 'installments_sale_tenant_fk',
      columns: [table.tenantId, table.saleId],
      foreignColumns: [sales.tenantId, sales.id],
    }),
    check(
      'installments_amounts_chk',
      sql`sequence >= 1 AND amount > 0 AND paid_amount >= 0 AND paid_amount <= amount`,
    ),
  ],
);

export const payments = pgTable(
  'payments',
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
    amount: numeric('amount', { precision: 14, scale: 2 }).notNull(),
    reversedAmount: numeric('reversed_amount', { precision: 14, scale: 2 })
      .notNull()
      .default('0.00'),
    method: paymentMethodEnum('method').notNull(),
    paidAt: timestamp('paid_at', { withTimezone: true }).notNull(),
    notes: varchar('notes', { length: 500 }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('payments_tenant_id_uidx').on(table.tenantId, table.id),
    index('payments_tenant_installment_idx').on(table.tenantId, table.installmentId),
    index('payments_tenant_sale_idx').on(table.tenantId, table.saleId),
    foreignKey({
      name: 'payments_sale_tenant_fk',
      columns: [table.tenantId, table.saleId],
      foreignColumns: [sales.tenantId, sales.id],
    }),
    foreignKey({
      name: 'payments_installment_tenant_fk',
      columns: [table.tenantId, table.installmentId],
      foreignColumns: [installments.tenantId, installments.id],
    }),
    check(
      'payments_amounts_chk',
      sql`amount > 0 AND reversed_amount >= 0 AND reversed_amount <= amount`,
    ),
  ],
);

export const paymentReversals = pgTable(
  'payment_reversals',
  {
    id: uuid('id').primaryKey(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id),
    paymentId: uuid('payment_id')
      .notNull()
      .references(() => payments.id),
    amount: numeric('amount', { precision: 14, scale: 2 }).notNull(),
    reason: varchar('reason', { length: 500 }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('payment_reversals_tenant_payment_idx').on(table.tenantId, table.paymentId),
    foreignKey({
      name: 'payment_reversals_payment_tenant_fk',
      columns: [table.tenantId, table.paymentId],
      foreignColumns: [payments.tenantId, payments.id],
    }),
    check('payment_reversals_amount_chk', sql`amount > 0`),
  ],
);

export const saleStatusHistory = pgTable(
  'sale_status_history',
  {
    id: uuid('id').primaryKey(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id),
    saleId: uuid('sale_id')
      .notNull()
      .references(() => sales.id),
    fromStatus: saleStatusEnum('from_status'),
    toStatus: saleStatusEnum('to_status').notNull(),
    reason: varchar('reason', { length: 64 }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('sale_status_history_tenant_sale_idx').on(table.tenantId, table.saleId),
    foreignKey({
      name: 'sale_status_history_sale_tenant_fk',
      columns: [table.tenantId, table.saleId],
      foreignColumns: [sales.tenantId, sales.id],
    }),
  ],
);

export const installmentStatusHistory = pgTable(
  'installment_status_history',
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
    fromStatus: installmentStatusEnum('from_status'),
    toStatus: installmentStatusEnum('to_status').notNull(),
    reason: varchar('reason', { length: 64 }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('installment_status_history_tenant_sale_idx').on(table.tenantId, table.saleId),
    foreignKey({
      name: 'installment_status_history_sale_tenant_fk',
      columns: [table.tenantId, table.saleId],
      foreignColumns: [sales.tenantId, sales.id],
    }),
    foreignKey({
      name: 'installment_status_history_installment_tenant_fk',
      columns: [table.tenantId, table.installmentId],
      foreignColumns: [installments.tenantId, installments.id],
    }),
  ],
);
