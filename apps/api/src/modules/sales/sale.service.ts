import { HttpException, HttpStatus } from '@nestjs/common';
import {
  buildInstallmentPlan,
  formatMoney,
  money,
  presentInstallmentStatus,
  todayIsoDate,
  type CreateSaleInput,
  type InstallmentStatus,
  type RecordPaymentInput,
  type ReversePaymentInput,
  type SaleStatus,
} from '@crediplus/shared';
import { v7 as uuidv7 } from 'uuid';
import type { CollectionService } from '../collection/collection.service';
import { runWithRls } from '../tenants/rls-als';
import type { CustomerRepository, TenantRepository } from '../tenants/tenant.types';
import type {
  InstallmentRecord,
  PaymentRecord,
  SaleItemRecord,
  SaleListRow,
  SaleRecord,
  SaleRepository,
  StatusHistoryRecord,
} from './sale.types';

const NOT_FOUND = 'Recurso não encontrado.';

export type PublicSaleItem = {
  id: string;
  description: string;
  quantity: number;
  unitPrice: string;
  lineTotal: string;
};

export type PublicInstallment = {
  id: string;
  sequence: number;
  dueDate: string;
  amount: string;
  paidAmount: string;
  remaining: string;
  status: InstallmentStatus;
  late: boolean;
};

export type PublicPayment = {
  id: string;
  installmentId: string;
  amount: string;
  reversedAmount: string;
  netAmount: string;
  method: PaymentRecord['method'];
  paidAt: Date;
  notes: string | null;
};

export type PublicStatusHistory = {
  id: string;
  entity: 'sale' | 'installment';
  saleId: string;
  installmentId: string | null;
  fromStatus: string | null;
  toStatus: string;
  reason: string;
  createdAt: Date;
};

export type PublicSale = {
  id: string;
  customerId: string;
  customerName: string;
  status: SaleStatus;
  settled: boolean;
  notes: string | null;
  totalAmount: string;
  downPayment: string;
  financedAmount: string;
  installmentCount: number;
  frequency: SaleRecord['frequency'];
  firstDueDate: string;
  createdAt: Date;
  items: PublicSaleItem[];
  installments: PublicInstallment[];
  payments: PublicPayment[];
  history: PublicStatusHistory[];
  collectionMessages: {
    id: string;
    kind: string;
    channel: string;
    status: string;
    body: string;
    recipient: string | null;
    createdAt: Date;
  }[];
};

export class SaleService {
  constructor(
    private readonly sales: SaleRepository,
    private readonly customers: CustomerRepository,
    private readonly tenants: TenantRepository,
    private readonly now: () => Date = () => new Date(),
    private readonly collection?: CollectionService,
  ) {}

  async list(
    tenantId: string,
    query: { customerId?: string; status?: SaleStatus },
  ): Promise<
    Omit<
      PublicSale,
      'items' | 'installments' | 'payments' | 'history' | 'collectionMessages'
    >[]
  > {
    return runWithRls({ tenantId, isSuperAdmin: false }, async () => {
      const reminder = await this.reminderDays(tenantId);
      const rows = await this.sales.listSales(tenantId, query);
      const installments = await this.sales.listInstallmentsForSales(
        tenantId,
        rows.map((row) => row.id),
      );
      const bySale = new Map<string, InstallmentRecord[]>();
      for (const installment of installments) {
        const current = bySale.get(installment.saleId) ?? [];
        current.push(installment);
        bySale.set(installment.saleId, current);
      }
      return rows.map((row) => this.toListItem(row, bySale.get(row.id) ?? [], reminder));
    });
  }

  async get(tenantId: string, id: string): Promise<PublicSale> {
    return runWithRls({ tenantId, isSuperAdmin: false }, async () => {
      const sale = await this.sales.findSale(tenantId, id);
      if (!sale) {
        throw new HttpException(NOT_FOUND, HttpStatus.NOT_FOUND);
      }
      const reminder = await this.reminderDays(tenantId);
      const [items, installments, payments, history] = await Promise.all([
        this.sales.listItems(tenantId, id),
        this.sales.listInstallments(tenantId, id),
        this.sales.listPayments(tenantId, id),
        this.sales.listHistory(tenantId, id),
      ]);
      const collectionMessages = this.collection
        ? await this.collection.listMessages(tenantId, id)
        : [];
      return this.toPublic(
        sale,
        items,
        installments,
        payments,
        reminder,
        history,
        collectionMessages,
      );
    });
  }

  async create(tenantId: string, input: CreateSaleInput): Promise<PublicSale> {
    return runWithRls({ tenantId, isSuperAdmin: false }, async () => {
      const customer = await this.customers.findById(tenantId, input.customerId);
      if (!customer || customer.status !== 'active') {
        throw new HttpException(NOT_FOUND, HttpStatus.NOT_FOUND);
      }
      const items: SaleItemRecord[] = input.items.map((item) => {
        const lineTotal = formatMoney(money(item.unitPrice).times(item.quantity));
        return {
          id: uuidv7(),
          tenantId,
          saleId: '',
          description: item.description.trim(),
          quantity: item.quantity,
          unitPrice: formatMoney(item.unitPrice),
          lineTotal,
        };
      });
      const total = items.reduce((acc, item) => acc.plus(item.lineTotal), money(0));
      if (total.lte(0)) {
        throw new HttpException(
          'O total da venda deve ser positivo.',
          HttpStatus.BAD_REQUEST,
        );
      }
      const down = money(input.downPayment ?? '0');
      if (down.gte(total)) {
        throw new HttpException(
          'A entrada deve ser menor que o total.',
          HttpStatus.BAD_REQUEST,
        );
      }
      const financed = total.minus(down);
      const now = this.now();
      const saleId = uuidv7();
      const sale: SaleRecord = {
        id: saleId,
        tenantId,
        customerId: customer.id,
        status: 'open',
        notes: input.notes?.trim() ? input.notes.trim() : null,
        totalAmount: formatMoney(total),
        downPayment: formatMoney(down),
        financedAmount: formatMoney(financed),
        installmentCount: input.installmentCount,
        frequency: input.frequency,
        firstDueDate: input.firstDueDate,
        createdAt: now,
        updatedAt: now,
      };
      const plan = buildInstallmentPlan({
        financed: sale.financedAmount,
        count: input.installmentCount,
        firstDueDate: input.firstDueDate,
        frequency: input.frequency,
      });
      const installments: InstallmentRecord[] = plan.map((row) => ({
        id: uuidv7(),
        tenantId,
        saleId,
        sequence: row.sequence,
        dueDate: row.dueDate,
        amount: row.amount,
        paidAmount: '0.00',
        status: 'OPEN',
        createdAt: now,
        updatedAt: now,
      }));
      const withSaleId = items.map((item) => ({ ...item, saleId }));
      await this.sales.createBundle({
        sale,
        items: withSaleId,
        installments,
        customerName: customer.name,
      });
      const reminder = await this.reminderDays(tenantId);
      const history = await this.sales.listHistory(tenantId, saleId);
      return this.toPublic(
        { ...sale, customerName: customer.name },
        withSaleId,
        installments,
        [],
        reminder,
        history,
        [],
      );
    });
  }

  async cancel(tenantId: string, id: string): Promise<void> {
    await runWithRls({ tenantId, isSuperAdmin: false }, async () => {
      const result = await this.sales.cancelSale(tenantId, id, this.now());
      if (result === 'not_found') {
        throw new HttpException(NOT_FOUND, HttpStatus.NOT_FOUND);
      }
      if (result === 'has_payments') {
        throw new HttpException(
          'Não é possível cancelar venda com pagamento registrado.',
          HttpStatus.CONFLICT,
        );
      }
    });
  }

  async recordPayment(
    tenantId: string,
    saleId: string,
    input: RecordPaymentInput,
  ): Promise<PublicSale> {
    return runWithRls({ tenantId, isSuperAdmin: false }, async () => {
      const amount = money(input.amount);
      if (amount.lte(0)) {
        throw new HttpException(
          'O valor do pagamento deve ser positivo.',
          HttpStatus.BAD_REQUEST,
        );
      }
      const now = this.now();
      const paymentId = uuidv7();
      const result = await this.sales.applyPayment({
        id: paymentId,
        tenantId,
        saleId,
        installmentId: input.installmentId,
        amount: formatMoney(amount),
        reversedAmount: '0.00',
        method: input.method,
        paidAt: now,
        notes: input.notes?.trim() ? input.notes.trim() : null,
        createdAt: now,
      });
      if (result === 'not_found') {
        throw new HttpException(NOT_FOUND, HttpStatus.NOT_FOUND);
      }
      if (result === 'sale_cancelled') {
        throw new HttpException('Venda cancelada.', HttpStatus.CONFLICT);
      }
      if (result === 'installment_cancelled') {
        throw new HttpException('Parcela cancelada.', HttpStatus.CONFLICT);
      }
      if (result === 'insufficient') {
        throw new HttpException(
          'Pagamento maior que o saldo da parcela.',
          HttpStatus.BAD_REQUEST,
        );
      }
      if (this.collection) {
        await this.collection.notifyPaymentReceived({
          tenantId,
          saleId,
          installmentId: input.installmentId,
          paymentId,
          amount: formatMoney(amount),
        });
      }
      return this.get(tenantId, saleId);
    });
  }

  async reversePayment(
    tenantId: string,
    saleId: string,
    paymentId: string,
    input: ReversePaymentInput,
  ): Promise<PublicSale> {
    return runWithRls({ tenantId, isSuperAdmin: false }, async () => {
      const now = this.now();
      const result = await this.sales.applyReversal(
        {
          id: uuidv7(),
          tenantId,
          paymentId,
          amount: input.amount,
          reason: input.reason.trim(),
          createdAt: now,
        },
        saleId,
      );
      if (result === 'not_found') {
        throw new HttpException(NOT_FOUND, HttpStatus.NOT_FOUND);
      }
      if (result === 'sale_cancelled') {
        throw new HttpException('Venda cancelada.', HttpStatus.CONFLICT);
      }
      if (result === 'invalid_amount') {
        throw new HttpException('Valor de estorno inválido.', HttpStatus.BAD_REQUEST);
      }
      return this.get(tenantId, saleId);
    });
  }

  private async reminderDays(tenantId: string): Promise<number> {
    const settings = await this.tenants.findSettings(tenantId);
    return settings?.reminderDaysBeforeDue ?? 3;
  }

  private toListItem(
    sale: SaleListRow,
    installments: InstallmentRecord[],
    reminder: number,
  ): Omit<
    PublicSale,
    'items' | 'installments' | 'payments' | 'history' | 'collectionMessages'
  > {
    const presented = installments.map((item) => this.toInstallment(item, reminder));
    return {
      id: sale.id,
      customerId: sale.customerId,
      customerName: sale.customerName,
      status: sale.status,
      settled:
        sale.status === 'open' && presented.every((item) => item.status === 'PAID'),
      notes: sale.notes,
      totalAmount: sale.totalAmount,
      downPayment: sale.downPayment,
      financedAmount: sale.financedAmount,
      installmentCount: sale.installmentCount,
      frequency: sale.frequency,
      firstDueDate: sale.firstDueDate,
      createdAt: sale.createdAt,
    };
  }

  private toPublic(
    sale: SaleListRow,
    items: SaleItemRecord[],
    installments: InstallmentRecord[],
    payments: PaymentRecord[],
    reminder: number,
    history: StatusHistoryRecord[] = [],
    collectionMessages: PublicSale['collectionMessages'] = [],
  ): PublicSale {
    const presented = installments.map((item) => this.toInstallment(item, reminder));
    return {
      ...this.toListItem(sale, installments, reminder),
      items: items.map((item) => ({
        id: item.id,
        description: item.description,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        lineTotal: item.lineTotal,
      })),
      installments: presented,
      payments: payments.map((item) => ({
        id: item.id,
        installmentId: item.installmentId,
        amount: item.amount,
        reversedAmount: item.reversedAmount,
        netAmount: formatMoney(money(item.amount).minus(item.reversedAmount)),
        method: item.method,
        paidAt: item.paidAt,
        notes: item.notes,
      })),
      history: history.map((item) => ({
        id: item.id,
        entity: item.entity,
        saleId: item.saleId,
        installmentId: item.installmentId,
        fromStatus: item.fromStatus,
        toStatus: item.toStatus,
        reason: item.reason,
        createdAt: item.createdAt,
      })),
      collectionMessages,
    };
  }

  private toInstallment(row: InstallmentRecord, reminder: number): PublicInstallment {
    const today = todayIsoDate(this.now());
    const status = presentInstallmentStatus({
      stored: row.status,
      amount: row.amount,
      paidAmount: row.paidAmount,
      dueDate: row.dueDate,
      today,
      reminderDaysBeforeDue: reminder,
    });
    return {
      id: row.id,
      sequence: row.sequence,
      dueDate: row.dueDate,
      amount: row.amount,
      paidAmount: row.paidAmount,
      remaining: formatMoney(money(row.amount).minus(row.paidAmount)),
      status,
      late: row.dueDate < today && money(row.amount).minus(row.paidAmount).gt(0),
    };
  }
}
