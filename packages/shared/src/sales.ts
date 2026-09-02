import { z } from 'zod';
import { addCalendarDays, addCalendarMonths, assertIsoDate } from './dates';
import {
  installmentFrequencies,
  installmentStatuses,
  paymentMethods,
  type InstallmentFrequency,
} from './enums';
import { formatMoney, money, splitInstallments, type MoneyString } from './money';

export const saleStatuses = ['open', 'cancelled'] as const;
export type SaleStatus = (typeof saleStatuses)[number];

const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Data inválida.')
  .superRefine((value, ctx) => {
    try {
      assertIsoDate(value);
    } catch {
      ctx.addIssue({ code: 'custom', message: 'Data inválida.' });
    }
  });

export const moneyAmountSchema = z
  .union([z.string(), z.number()])
  .transform((value) => String(value).trim())
  .pipe(
    z
      .string()
      .regex(/^\d+(\.\d{1,2})?$/, 'Valor inválido.')
      .refine((value) => {
        const parsed = money(value);
        return !parsed.isNegative() && parsed.lte('999999999999.99');
      }, 'Valor inválido.')
      .transform((value) => formatMoney(value)),
  );

const saleItemSchema = z.object({
  description: z.string().trim().min(2).max(200),
  quantity: z.coerce.number().int().min(1).max(9_999),
  unitPrice: moneyAmountSchema,
});

export const createSaleSchema = z.object({
  customerId: z.string().uuid(),
  items: z.array(saleItemSchema).min(1).max(50),
  downPayment: moneyAmountSchema.optional(),
  installmentCount: z.coerce.number().int().min(1).max(60),
  frequency: z.enum(installmentFrequencies).default('monthly'),
  firstDueDate: isoDate,
  notes: z.string().trim().max(500).optional(),
});

export const listSalesQuerySchema = z.object({
  customerId: z.string().uuid().optional(),
  status: z.enum(saleStatuses).optional(),
});

export const recordPaymentSchema = z.object({
  installmentId: z.string().uuid(),
  amount: moneyAmountSchema,
  method: z.enum(paymentMethods),
  notes: z.string().trim().max(500).optional(),
});

export const reversePaymentSchema = z.object({
  amount: moneyAmountSchema.optional(),
  reason: z.string().trim().min(3).max(500),
});

export type CreateSaleInput = z.infer<typeof createSaleSchema>;
export type RecordPaymentInput = z.infer<typeof recordPaymentSchema>;
export type ReversePaymentInput = z.infer<typeof reversePaymentSchema>;

export function nextDueDate(
  firstDueDate: string,
  frequency: InstallmentFrequency,
  index: number,
): string {
  if (index === 0) {
    return firstDueDate;
  }
  if (frequency === 'weekly') {
    return addCalendarDays(firstDueDate, 7 * index);
  }
  if (frequency === 'biweekly') {
    return addCalendarDays(firstDueDate, 14 * index);
  }
  return addCalendarMonths(firstDueDate, index);
}

export function buildInstallmentPlan(input: {
  financed: MoneyString | string;
  count: number;
  firstDueDate: string;
  frequency: InstallmentFrequency;
}): { sequence: number; dueDate: string; amount: MoneyString }[] {
  const amounts = splitInstallments(money(input.financed), input.count);
  return amounts.map((amount, index) => ({
    sequence: index + 1,
    dueDate: nextDueDate(input.firstDueDate, input.frequency, index),
    amount: formatMoney(amount),
  }));
}

export function paymentDrivenStatus(
  amount: string,
  paidAmount: string,
): 'OPEN' | 'PARTIALLY_PAID' | 'PAID' {
  if (money(paidAmount).gte(amount)) {
    return 'PAID';
  }
  if (money(paidAmount).gt(0)) {
    return 'PARTIALLY_PAID';
  }
  return 'OPEN';
}

export function presentInstallmentStatus(input: {
  stored: (typeof installmentStatuses)[number];
  amount: string;
  paidAmount: string;
  dueDate: string;
  today: string;
  reminderDaysBeforeDue: number;
}): (typeof installmentStatuses)[number] {
  if (input.stored === 'CANCELLED' || input.stored === 'RENEGOTIATED') {
    return input.stored;
  }
  const paid = paymentDrivenStatus(input.amount, input.paidAmount);
  if (paid !== 'OPEN') {
    return paid;
  }
  if (input.dueDate < input.today) {
    return 'OVERDUE';
  }
  const windowEnd = addCalendarDays(input.today, input.reminderDaysBeforeDue);
  if (input.dueDate <= windowEnd) {
    return 'DUE_SOON';
  }
  return 'OPEN';
}
