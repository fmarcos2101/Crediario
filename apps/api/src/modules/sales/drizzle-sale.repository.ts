import {
  and,
  applyRlsContext,
  customers,
  desc,
  eq,
  inArray,
  installments,
  paymentReversals,
  payments,
  saleItems,
  sales,
  type Database,
} from '@crediplus/db';
import {
  formatMoney,
  money,
  paymentDrivenStatus,
  type SaleStatus,
} from '@crediplus/shared';
import { getRlsContext } from '../tenants/rls-als';
import type {
  ApplyPaymentResult,
  ApplyReversalResult,
  CancelSaleResult,
  InstallmentRecord,
  PaymentRecord,
  PaymentReversalRecord,
  SaleItemRecord,
  SaleListRow,
  SaleRecord,
  SaleRepository,
} from './sale.types';

function asDateString(value: string | Date): string {
  if (typeof value === 'string') {
    return value.slice(0, 10);
  }
  return value.toISOString().slice(0, 10);
}

export class DrizzleSaleRepository implements SaleRepository {
  constructor(private readonly db: Database) {}

  private async withRls<T>(fn: (tx: Database) => Promise<T>): Promise<T> {
    return this.db.transaction(async (tx) => {
      await applyRlsContext(tx, getRlsContext());
      return fn(tx as unknown as Database);
    });
  }

  async createBundle(input: {
    sale: SaleRecord;
    items: SaleItemRecord[];
    installments: InstallmentRecord[];
    customerName: string;
  }): Promise<void> {
    await this.withRls(async (tx) => {
      await tx.insert(sales).values({
        id: input.sale.id,
        tenantId: input.sale.tenantId,
        customerId: input.sale.customerId,
        status: input.sale.status,
        notes: input.sale.notes,
        totalAmount: input.sale.totalAmount,
        downPayment: input.sale.downPayment,
        financedAmount: input.sale.financedAmount,
        installmentCount: input.sale.installmentCount,
        frequency: input.sale.frequency,
        firstDueDate: input.sale.firstDueDate,
        createdAt: input.sale.createdAt,
        updatedAt: input.sale.updatedAt,
      });
      if (input.items.length > 0) {
        await tx.insert(saleItems).values(input.items);
      }
      if (input.installments.length > 0) {
        await tx.insert(installments).values(input.installments);
      }
    });
    void input.customerName;
  }

  async findSale(tenantId: string, id: string): Promise<SaleListRow | null> {
    return this.withRls(async (tx) => {
      const rows = await tx
        .select({
          sale: sales,
          customerName: customers.name,
        })
        .from(sales)
        .innerJoin(customers, eq(customers.id, sales.customerId))
        .where(and(eq(sales.tenantId, tenantId), eq(sales.id, id)))
        .limit(1);
      const row = rows[0];
      return row ? this.mapSale(row.sale, row.customerName) : null;
    });
  }

  async listSales(
    tenantId: string,
    query: { customerId?: string; status?: SaleStatus },
  ): Promise<SaleListRow[]> {
    return this.withRls(async (tx) => {
      const filters = [eq(sales.tenantId, tenantId)];
      if (query.customerId) {
        filters.push(eq(sales.customerId, query.customerId));
      }
      if (query.status) {
        filters.push(eq(sales.status, query.status));
      }
      const rows = await tx
        .select({
          sale: sales,
          customerName: customers.name,
        })
        .from(sales)
        .innerJoin(customers, eq(customers.id, sales.customerId))
        .where(and(...filters))
        .orderBy(desc(sales.createdAt));
      return rows.map((row) => this.mapSale(row.sale, row.customerName));
    });
  }

  async listItems(tenantId: string, saleId: string): Promise<SaleItemRecord[]> {
    return this.withRls(async (tx) => {
      return tx
        .select()
        .from(saleItems)
        .where(and(eq(saleItems.tenantId, tenantId), eq(saleItems.saleId, saleId)));
    });
  }

  async listInstallments(tenantId: string, saleId: string): Promise<InstallmentRecord[]> {
    const rows = await this.listInstallmentsForSales(tenantId, [saleId]);
    return rows.sort((a, b) => a.sequence - b.sequence);
  }

  async listInstallmentsForSales(
    tenantId: string,
    saleIds: string[],
  ): Promise<InstallmentRecord[]> {
    if (saleIds.length === 0) {
      return [];
    }
    return this.withRls(async (tx) => {
      const rows = await tx
        .select()
        .from(installments)
        .where(
          and(eq(installments.tenantId, tenantId), inArray(installments.saleId, saleIds)),
        )
        .orderBy(installments.sequence);
      return rows.map((row) => this.mapInstallment(row));
    });
  }

  async listPayments(tenantId: string, saleId: string): Promise<PaymentRecord[]> {
    return this.withRls(async (tx) => {
      return tx
        .select()
        .from(payments)
        .where(and(eq(payments.tenantId, tenantId), eq(payments.saleId, saleId)))
        .orderBy(desc(payments.paidAt));
    });
  }

  async findInstallment(tenantId: string, id: string): Promise<InstallmentRecord | null> {
    return this.withRls(async (tx) => {
      const rows = await tx
        .select()
        .from(installments)
        .where(and(eq(installments.tenantId, tenantId), eq(installments.id, id)))
        .limit(1);
      const row = rows[0];
      return row ? this.mapInstallment(row) : null;
    });
  }

  async findPayment(tenantId: string, id: string): Promise<PaymentRecord | null> {
    return this.withRls(async (tx) => {
      const rows = await tx
        .select()
        .from(payments)
        .where(and(eq(payments.tenantId, tenantId), eq(payments.id, id)))
        .limit(1);
      return rows[0] ?? null;
    });
  }

  async cancelSale(
    tenantId: string,
    saleId: string,
    at: Date,
  ): Promise<CancelSaleResult> {
    return this.withRls(async (tx) => {
      const saleRows = await tx
        .select()
        .from(sales)
        .where(and(eq(sales.id, saleId), eq(sales.tenantId, tenantId)))
        .for('update')
        .limit(1);
      const sale = saleRows[0];
      if (!sale) {
        return 'not_found';
      }
      if (sale.status === 'cancelled') {
        return 'already_cancelled';
      }
      const related = await tx
        .select()
        .from(installments)
        .where(and(eq(installments.saleId, saleId), eq(installments.tenantId, tenantId)))
        .for('update');
      if (related.some((item) => money(item.paidAmount).gt(0))) {
        return 'has_payments';
      }
      await tx
        .update(sales)
        .set({ status: 'cancelled', updatedAt: at })
        .where(and(eq(sales.id, saleId), eq(sales.tenantId, tenantId)));
      if (related.length > 0) {
        await tx
          .update(installments)
          .set({ status: 'CANCELLED', updatedAt: at })
          .where(
            and(eq(installments.saleId, saleId), eq(installments.tenantId, tenantId)),
          );
      }
      return 'cancelled';
    });
  }

  async applyPayment(payment: PaymentRecord): Promise<ApplyPaymentResult> {
    return this.withRls(async (tx) => {
      const saleRows = await tx
        .select()
        .from(sales)
        .where(and(eq(sales.id, payment.saleId), eq(sales.tenantId, payment.tenantId)))
        .for('update')
        .limit(1);
      const sale = saleRows[0];
      if (!sale) {
        return 'not_found';
      }
      if (sale.status !== 'open') {
        return 'sale_cancelled';
      }
      const installmentRows = await tx
        .select()
        .from(installments)
        .where(
          and(
            eq(installments.id, payment.installmentId),
            eq(installments.tenantId, payment.tenantId),
          ),
        )
        .for('update')
        .limit(1);
      const installment = installmentRows[0];
      if (!installment || installment.saleId !== payment.saleId) {
        return 'not_found';
      }
      if (installment.status === 'CANCELLED') {
        return 'installment_cancelled';
      }
      const remaining = money(installment.amount).minus(installment.paidAmount);
      if (money(payment.amount).gt(remaining)) {
        return 'insufficient';
      }
      const paidAmount = formatMoney(money(installment.paidAmount).plus(payment.amount));
      await tx.insert(payments).values(payment);
      await tx
        .update(installments)
        .set({
          paidAmount,
          status: paymentDrivenStatus(installment.amount, paidAmount),
          updatedAt: payment.createdAt,
        })
        .where(
          and(
            eq(installments.id, installment.id),
            eq(installments.tenantId, installment.tenantId),
          ),
        );
      return 'applied';
    });
  }

  async applyReversal(
    reversal: Omit<PaymentReversalRecord, 'amount'> & { amount?: string },
    saleId: string,
  ): Promise<ApplyReversalResult> {
    return this.withRls(async (tx) => {
      const saleRows = await tx
        .select()
        .from(sales)
        .where(and(eq(sales.id, saleId), eq(sales.tenantId, reversal.tenantId)))
        .for('update')
        .limit(1);
      const sale = saleRows[0];
      if (!sale) {
        return 'not_found';
      }
      if (sale.status !== 'open') {
        return 'sale_cancelled';
      }
      const paymentRows = await tx
        .select()
        .from(payments)
        .where(
          and(
            eq(payments.id, reversal.paymentId),
            eq(payments.tenantId, reversal.tenantId),
            eq(payments.saleId, saleId),
          ),
        )
        .for('update')
        .limit(1);
      const payment = paymentRows[0];
      if (!payment) {
        return 'not_found';
      }
      const installmentRows = await tx
        .select()
        .from(installments)
        .where(
          and(
            eq(installments.id, payment.installmentId),
            eq(installments.tenantId, payment.tenantId),
          ),
        )
        .for('update')
        .limit(1);
      const installment = installmentRows[0];
      if (!installment) {
        return 'not_found';
      }
      const reversible = money(payment.amount).minus(payment.reversedAmount);
      const amount = reversal.amount ? money(reversal.amount) : reversible;
      if (amount.lte(0) || amount.gt(reversible)) {
        return 'invalid_amount';
      }
      const reversedAmount = formatMoney(money(payment.reversedAmount).plus(amount));
      const paidAmount = formatMoney(money(installment.paidAmount).minus(amount));
      await tx.insert(paymentReversals).values({
        id: reversal.id,
        tenantId: reversal.tenantId,
        paymentId: reversal.paymentId,
        amount: formatMoney(amount),
        reason: reversal.reason,
        createdAt: reversal.createdAt,
      });
      await tx
        .update(payments)
        .set({ reversedAmount })
        .where(and(eq(payments.id, payment.id), eq(payments.tenantId, payment.tenantId)));
      await tx
        .update(installments)
        .set({
          paidAmount,
          status: paymentDrivenStatus(installment.amount, paidAmount),
          updatedAt: reversal.createdAt,
        })
        .where(
          and(
            eq(installments.id, installment.id),
            eq(installments.tenantId, installment.tenantId),
          ),
        );
      return 'applied';
    });
  }

  private mapSale(row: typeof sales.$inferSelect, customerName: string): SaleListRow {
    return {
      id: row.id,
      tenantId: row.tenantId,
      customerId: row.customerId,
      status: row.status,
      notes: row.notes,
      totalAmount: row.totalAmount,
      downPayment: row.downPayment,
      financedAmount: row.financedAmount,
      installmentCount: row.installmentCount,
      frequency: row.frequency,
      firstDueDate: asDateString(row.firstDueDate),
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      customerName,
    };
  }

  private mapInstallment(row: typeof installments.$inferSelect): InstallmentRecord {
    return {
      id: row.id,
      tenantId: row.tenantId,
      saleId: row.saleId,
      sequence: row.sequence,
      dueDate: asDateString(row.dueDate),
      amount: row.amount,
      paidAmount: row.paidAmount,
      status: row.status,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }
}
