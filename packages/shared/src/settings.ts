import { z } from 'zod';
import { paymentProviders } from './enums';

const days = z.number().int().min(0).max(365);
const hours = z.number().int().min(1).max(720);
const messageBody = z.string().trim().min(1).max(2000);

export const updateTenantSettingsSchema = z.object({
  timezone: z.string().trim().min(3).max(64).optional(),
  locale: z.string().trim().min(2).max(16).optional(),
  lateInterestEnabled: z.boolean().optional(),
  lateInterestMonthlyRate: z.string().nullable().optional(),
  lateFineEnabled: z.boolean().optional(),
  lateFineType: z.enum(['fixed', 'percent']).nullable().optional(),
  lateFineValue: z.string().nullable().optional(),
  signatureOtpOnDevice: z.boolean().optional(),
  signatureOtpQr: z.boolean().optional(),
  reminderDaysBeforeDue: days.optional(),
  overdueNudgeDays: days.optional(),
  protestWarningDays: days.optional(),
  collectionResponseHours: hours.optional(),
  msgDueReminderEnabled: z.boolean().optional(),
  msgDueReminderBody: messageBody.optional(),
  msgOverdueEnabled: z.boolean().optional(),
  msgOverdueBody: messageBody.optional(),
  msgProtestWarningEnabled: z.boolean().optional(),
  msgProtestWarningBody: messageBody.optional(),
  msgPaymentReceivedEnabled: z.boolean().optional(),
  msgPaymentReceivedBody: messageBody.optional(),
  paymentProvider: z.enum(paymentProviders).optional(),
  paymentApiKey: z.string().min(1).max(500).optional(),
  paymentWebhookSecret: z.string().min(1).max(500).optional(),
  clearPaymentSecrets: z.boolean().optional(),
  metaPhoneNumberId: z.string().trim().max(64).nullable().optional(),
  metaWabaId: z.string().trim().max(64).nullable().optional(),
  metaAccessToken: z.string().min(1).max(2000).optional(),
  metaAppSecret: z.string().min(1).max(500).optional(),
  clearMetaSecrets: z.boolean().optional(),
});

export type UpdateTenantSettingsInput = z.infer<typeof updateTenantSettingsSchema>;

export const DEFAULT_MSG_DUE_REMINDER =
  'Olá {nome}, sua parcela vence em {data}. Qualquer dúvida, fale conosco.';
export const DEFAULT_MSG_OVERDUE =
  'Olá {nome}, sua parcela venceu em {data}. Regularize para evitar encargos.';
export const DEFAULT_MSG_PROTEST_WARNING =
  'Olá {nome}, o título da parcela vencida em {data} poderá ser protestado. Entre em contato para regularizar.';
export const DEFAULT_MSG_PAYMENT_RECEIVED =
  'Olá {nome}, recebemos seu pagamento. Obrigado.';
