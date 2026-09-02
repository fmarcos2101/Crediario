import { z } from 'zod';
import { calendarDayDiff, formatIsoDatePtBr } from './dates';
import { paymentMethods } from './enums';
import { moneyAmountSchema } from './sales';

export const collectionKinds = [
  'due_reminder',
  'overdue',
  'protest_warning',
  'payment_received',
] as const;
export type CollectionKind = (typeof collectionKinds)[number];

export const collectionChannels = ['email', 'none'] as const;
export type CollectionChannel = (typeof collectionChannels)[number];

export const collectionMessageStatuses = [
  'sent',
  'skipped_no_channel',
  'skipped_disabled',
] as const;
export type CollectionMessageStatus = (typeof collectionMessageStatuses)[number];

export const paymentWebhookStatuses = [
  'applied',
  'duplicate',
  'ignored',
  'failed',
] as const;
export type PaymentWebhookStatus = (typeof paymentWebhookStatuses)[number];

export const paymentWebhookSchema = z.object({
  eventId: z.string().trim().min(1).max(200),
  installmentId: z.string().uuid(),
  amount: moneyAmountSchema,
  method: z.enum(paymentMethods).optional(),
  paidAt: z.string().datetime().optional(),
});

export type PaymentWebhookInput = z.infer<typeof paymentWebhookSchema>;

export function collectionOccurrenceKey(
  kind: CollectionKind,
  installmentId: string,
  extra: string,
): string {
  return `${kind}:${installmentId}:${extra}`;
}

export function planCollection(input: {
  remainingPositive: boolean;
  cancelled: boolean;
  dueDate: string;
  today: string;
  reminderDaysBeforeDue: number;
  overdueNudgeDays: number;
  protestWarningDays: number;
  sentKinds: CollectionKind[];
}): CollectionKind[] {
  if (!input.remainingPositive || input.cancelled) {
    return [];
  }
  const sent = new Set(input.sentKinds);
  const untilDue = calendarDayDiff(input.today, input.dueDate);
  const overdueDays = calendarDayDiff(input.dueDate, input.today);
  const planned: CollectionKind[] = [];
  if (
    untilDue >= 0 &&
    untilDue <= input.reminderDaysBeforeDue &&
    !sent.has('due_reminder')
  ) {
    planned.push('due_reminder');
  }
  if (overdueDays >= input.overdueNudgeDays && overdueDays > 0 && !sent.has('overdue')) {
    planned.push('overdue');
  }
  if (
    overdueDays >= input.protestWarningDays &&
    overdueDays > 0 &&
    !sent.has('protest_warning')
  ) {
    planned.push('protest_warning');
  }
  return planned;
}

export function renderCollectionTemplate(
  template: string,
  vars: { nome: string; data: string; valor?: string },
): string {
  return template
    .replaceAll('{nome}', vars.nome)
    .replaceAll('{data}', vars.data)
    .replaceAll('{valor}', vars.valor ?? '');
}

export function collectionEmailSubject(kind: CollectionKind): string {
  if (kind === 'due_reminder') {
    return 'Lembrete de parcela';
  }
  if (kind === 'overdue') {
    return 'Parcela em atraso';
  }
  if (kind === 'protest_warning') {
    return 'Aviso de protesto';
  }
  return 'Pagamento recebido';
}

export function collectionTemplateDate(isoDate: string): string {
  return formatIsoDatePtBr(isoDate);
}
