import { z } from 'zod';
import { isValidCpf, normalizeCpf } from './cpf';

export const customerStatuses = ['active', 'archived'] as const;
export type CustomerStatus = (typeof customerStatuses)[number];

const cpfField = z
  .string()
  .trim()
  .min(11)
  .max(14)
  .refine((value) => isValidCpf(value), { message: 'CPF inválido.' })
  .transform((value) => normalizeCpf(value));

export const createCustomerSchema = z.object({
  name: z.string().trim().min(2).max(160),
  cpf: cpfField,
  phone: z
    .string()
    .trim()
    .max(32)
    .optional()
    .transform((value) => (value && value.length > 0 ? value : undefined)),
  email: z
    .string()
    .trim()
    .email()
    .max(320)
    .optional()
    .or(z.literal(''))
    .transform((value) => (value ? value : undefined)),
  notes: z.string().trim().max(500).optional(),
});

export const updateCustomerSchema = z.object({
  name: z.string().trim().min(2).max(160).optional(),
  cpf: cpfField.optional(),
  phone: z.string().trim().max(32).nullable().optional(),
  email: z.string().trim().email().max(320).nullable().optional().or(z.literal('')),
  notes: z.string().trim().max(500).nullable().optional(),
});

export const listCustomersQuerySchema = z.object({
  q: z.string().trim().max(160).optional(),
  status: z.enum(customerStatuses).optional(),
});

export type CreateCustomerInput = z.infer<typeof createCustomerSchema>;
export type UpdateCustomerInput = z.infer<typeof updateCustomerSchema>;
