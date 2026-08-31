import type { SaleStatus } from '@crediplus/shared';
import { formatMoney, money, paymentDrivenStatus } from '@crediplus/shared';
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

export class MemorySaleRepository implements SaleRepository {
  sales: SaleRecord[] = [];
  items: SaleItemRecord[] = [];
  installments: InstallmentRecord[] = [];
  payments: PaymentRecord[] = [];
  reversals: PaymentReversalRecord[] = [];
  customerNames = new Map<string, string>();

  async createBundle(input: {
    sale: SaleRecord;
    items: SaleItemRecord[];
    installments: InstallmentRecord[];
    customerName: string;
  }): Promise<void> {
    this.sales.push({ ...input.sale });
    this.items.push(...input.items.map((item) => ({ ...item })));
    this.installments.push(...input.installments.map((item) => ({ ...item })));
    this.customerNames.set(input.sale.customerId, input.customerName);
  }

  async findSale(tenantId: string, id: string): Promise<SaleListRow | null> {
    const sale = this.sales.find((item) => item.tenantId === tenantId && item.id === id);
    if (!sale) {
      return null;
    }
    return {
      ...sale,
      customerName: this.customerNames.get(sale.customerId) ?? 'Cliente',
    };
  }

  async listSales(
    tenantId: string,
    query: { customerId?: string; status?: SaleStatus },
  ): Promise<SaleListRow[]> {
    return this.sales
      .filter((item) => item.tenantId === tenantId)
      .filter((item) => (query.customerId ? item.customerId === query.customerId : true))
      .filter((item) => (query.status ? item.status === query.status : true))
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .map((sale) => ({
        ...sale,
        customerName: this.customerNames.get(sale.customerId) ?? 'Cliente',
      }));
  }

  async listItems(tenantId: string, saleId: string): Promise<SaleItemRecord[]> {
    return this.items.filter(
      (item) => item.tenantId === tenantId && item.saleId === saleId,
    );
  }

  async listInstallments(tenantId: string, saleId: string): Promise<InstallmentRecord[]> {
    return this.installments
      .filter((item) => item.tenantId === tenantId && item.saleId === saleId)
      .sort((a, b) => a.sequence - b.sequence);
  }

  async listInstallmentsForSales(
    tenantId: string,
    saleIds: string[],
  ): Promise<InstallmentRecord[]> {
    const allowed = new Set(saleIds);
    return this.installments
      .filter((item) => item.tenantId === tenantId && allowed.has(item.saleId))
      .sort((a, b) => a.sequence - b.sequence);
  }

  async listPayments(tenantId: string, saleId: string): Promise<PaymentRecord[]> {
    return this.payments
      .filter((item) => item.tenantId === tenantId && item.saleId === saleId)
      .sort((a, b) => b.paidAt.getTime() - a.paidAt.getTime());
  }

  async findInstallment(tenantId: string, id: string): Promise<InstallmentRecord | null> {
    return (
      this.installments.find((item) => item.tenantId === tenantId && item.id === id) ??
      null
    );
  }

  async findPayment(tenantId: string, id: string): Promise<PaymentRecord | null> {
    return (
      this.payments.find((item) => item.tenantId === tenantId && item.id === id) ?? null
    );
  }

  async cancelSale(
    tenantId: string,
    saleId: string,
    at: Date,
  ): Promise<CancelSaleResult> {
    const sale = this.sales.find(
      (item) => item.tenantId === tenantId && item.id === saleId,
    );
    if (!sale) {
      return 'not_found';
    }
    if (sale.status === 'cancelled') {
      return 'already_cancelled';
    }
    const related = this.installments.filter(
      (item) => item.tenantId === tenantId && item.saleId === saleId,
    );
    if (related.some((item) => money(item.paidAmount).gt(0))) {
      return 'has_payments';
    }
    sale.status = 'cancelled';
    sale.updatedAt = at;
    for (const installment of related) {
      installment.status = 'CANCELLED';
      installment.updatedAt = at;
    }
    return 'cancelled';
  }

  async applyPayment(payment: PaymentRecord): Promise<ApplyPaymentResult> {
    const sale = this.sales.find(
      (item) => item.tenantId === payment.tenantId && item.id === payment.saleId,
    );
    if (!sale) {
      return 'not_found';
    }
    if (sale.status !== 'open') {
      return 'sale_cancelled';
    }
    const installment = this.installments.find(
      (item) => item.tenantId === payment.tenantId && item.id === payment.installmentId,
    );
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
    this.payments.push({ ...payment });
    installment.paidAmount = paidAmount;
    installment.status = paymentDrivenStatus(installment.amount, paidAmount);
    installment.updatedAt = payment.createdAt;
    return 'applied';
  }

  async applyReversal(
    reversal: Omit<PaymentReversalRecord, 'amount'> & { amount?: string },
    saleId: string,
  ): Promise<ApplyReversalResult> {
    const sale = this.sales.find(
      (item) => item.tenantId === reversal.tenantId && item.id === saleId,
    );
    if (!sale) {
      return 'not_found';
    }
    if (sale.status !== 'open') {
      return 'sale_cancelled';
    }
    const payment = this.payments.find(
      (item) =>
        item.tenantId === reversal.tenantId &&
        item.id === reversal.paymentId &&
        item.saleId === saleId,
    );
    if (!payment) {
      return 'not_found';
    }
    const installment = this.installments.find(
      (item) => item.tenantId === payment.tenantId && item.id === payment.installmentId,
    );
    if (!installment) {
      return 'not_found';
    }
    const reversible = money(payment.amount).minus(payment.reversedAmount);
    const amount = reversal.amount ? money(reversal.amount) : reversible;
    if (amount.lte(0) || amount.gt(reversible)) {
      return 'invalid_amount';
    }
    payment.reversedAmount = formatMoney(money(payment.reversedAmount).plus(amount));
    installment.paidAmount = formatMoney(money(installment.paidAmount).minus(amount));
    installment.status = paymentDrivenStatus(installment.amount, installment.paidAmount);
    installment.updatedAt = reversal.createdAt;
    this.reversals.push({
      id: reversal.id,
      tenantId: reversal.tenantId,
      paymentId: reversal.paymentId,
      amount: formatMoney(amount),
      reason: reversal.reason,
      createdAt: reversal.createdAt,
    });
    return 'applied';
  }
}
