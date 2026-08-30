import { z } from 'zod';

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
});

export type LoginInput = z.infer<typeof loginSchema>;
export type TotpInput = z.infer<typeof totpSchema>;
export type PublicUser = z.infer<typeof publicUserSchema>;

export function assertPasswordPolicy(password: string): void {
  if (password.length < MIN_PASSWORD_LENGTH) {
    throw new Error(`A senha deve ter pelo menos ${MIN_PASSWORD_LENGTH} caracteres.`);
  }
}
