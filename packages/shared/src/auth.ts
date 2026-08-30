import { z } from 'zod';
import { tenantStatuses } from './enums';

export const MIN_PASSWORD_LENGTH = 12;

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export const loginSchema = z.object({
  email: z.string().trim().email().max(320),
  password: z.string().min(1).max(200),
});

export const totpSchema = z.object({
  challengeToken: z.string().min(16).max(256),
  code: z.string().regex(/^\d{6}$/),
});

export const forgotPasswordSchema = z.object({
  email: z.string().trim().email().max(320),
});

export const resetPasswordSchema = z.object({
  token: z.string().min(16).max(256),
  password: z.string().min(MIN_PASSWORD_LENGTH).max(200),
});

export const publicUserSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  isSuperAdmin: z.boolean(),
  tenantId: z.string().uuid().nullable(),
  tenantName: z.string().nullable(),
  tenantStatus: z.enum(tenantStatuses).nullable(),
});

export type LoginInput = z.infer<typeof loginSchema>;
export type TotpInput = z.infer<typeof totpSchema>;
export type PublicUser = z.infer<typeof publicUserSchema>;

export function assertPasswordPolicy(password: string): void {
  if (password.length < MIN_PASSWORD_LENGTH) {
    throw new Error(`A senha deve ter pelo menos ${MIN_PASSWORD_LENGTH} caracteres.`);
  }
}

export const createTenantSchema = z.object({
  name: z.string().trim().min(2).max(160),
  ownerEmail: z.string().trim().email().max(320),
});

export const acceptInviteSchema = z.object({
  token: z.string().min(16).max(256),
  password: z.string().min(MIN_PASSWORD_LENGTH).max(200),
});

export const updateTenantSettingsSchema = z.object({
  lateInterestEnabled: z.boolean().optional(),
  lateInterestMonthlyRate: z.string().nullable().optional(),
  lateFineEnabled: z.boolean().optional(),
  lateFineType: z.enum(['fixed', 'percent']).nullable().optional(),
  lateFineValue: z.string().nullable().optional(),
  signatureOtpOnDevice: z.boolean().optional(),
  signatureOtpQr: z.boolean().optional(),
});

export type CreateTenantInput = z.infer<typeof createTenantSchema>;
export type AcceptInviteInput = z.infer<typeof acceptInviteSchema>;
