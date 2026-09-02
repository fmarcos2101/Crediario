import type {
  InstallmentFrequency,
  InstallmentStatus,
  PaymentMethod,
  SaleStatus,
} from '@crediplus/shared';

export type SaleRecord = {
  id: string;
  tenantId: string;
  customerId: string;
  status: SaleStatus;
  notes: string | null;
  totalAmount: string;
  downPayment: string;
  financedAmount: string;
  installmentCount: number;
  frequency: InstallmentFrequency;
  firstDueDate: string;
  createdAt: Date;
  updatedAt: Date;
};

export type SaleItemRecord = {
  id: string;
  tenantId: string;
  saleId: string;
  description: string;
  quantity: number;
  unitPrice: string;
  lineTotal: string;
};

export type InstallmentRecord = {
  id: string;
  tenantId: string;
  saleId: string;
  sequence: number;
  dueDate: string;
  amount: string;
  paidAmount: string;
  status: InstallmentStatus;
  createdAt: Date;
  updatedAt: Date;
};

export type PaymentRecord = {
  id: string;
  tenantId: string;
  saleId: string;
  installmentId: string;
  amount: string;
  reversedAmount: string;
  method: PaymentMethod;
  paidAt: Date;
  notes: string | null;
  createdAt: Date;
};

export type PaymentReversalRecord = {
  id: string;
  tenantId: string;
  paymentId: string;
  amount: string;
  reason: string;
  createdAt: Date;
};

export type SaleListRow = SaleRecord & { customerName: string };

export type ApplyPaymentResult =
  'applied' | 'not_found' | 'sale_cancelled' | 'installment_cancelled' | 'insufficient';

export type ApplyReversalResult =
  'applied' | 'not_found' | 'sale_cancelled' | 'invalid_amount';

export type CancelSaleResult =
  'cancelled' | 'not_found' | 'already_cancelled' | 'has_payments';

export type StatusHistoryRecord = {
  id: string;
  entity: 'sale' | 'installment';
  saleId: string;
  installmentId: string | null;
  fromStatus: string | null;
  toStatus: string;
  reason: string;
  createdAt: Date;
};

export type SaleRepository = {
  createBundle(input: {
    sale: SaleRecord;
    items: SaleItemRecord[];
    installments: InstallmentRecord[];
    customerName: string;
  }): Promise<void>;
  findSale(tenantId: string, id: string): Promise<SaleListRow | null>;
  listSales(
    tenantId: string,
    query: { customerId?: string; status?: SaleStatus },
  ): Promise<SaleListRow[]>;
  listItems(tenantId: string, saleId: string): Promise<SaleItemRecord[]>;
  listInstallments(tenantId: string, saleId: string): Promise<InstallmentRecord[]>;
  listInstallmentsForSales(
    tenantId: string,
    saleIds: string[],
  ): Promise<InstallmentRecord[]>;
  listPayments(tenantId: string, saleId: string): Promise<PaymentRecord[]>;
  findInstallment(tenantId: string, id: string): Promise<InstallmentRecord | null>;
  findPayment(tenantId: string, id: string): Promise<PaymentRecord | null>;
  cancelSale(tenantId: string, saleId: string, at: Date): Promise<CancelSaleResult>;
  applyPayment(payment: PaymentRecord): Promise<ApplyPaymentResult>;
  applyReversal(
    reversal: Omit<PaymentReversalRecord, 'amount'> & { amount?: string },
    saleId: string,
  ): Promise<ApplyReversalResult>;
  listHistory(tenantId: string, saleId: string): Promise<StatusHistoryRecord[]>;
};
