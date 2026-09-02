export const tenantStatuses = [
  'pending_setup',
  'pending_activation',
  'active',
  'suspended',
  'archived',
] as const;
export type TenantStatus = (typeof tenantStatuses)[number];

export const tenantUserStatuses = [
  'invited',
  'pending_activation',
  'active',
  'revoked',
] as const;
export type TenantUserStatus = (typeof tenantUserStatuses)[number];

export const installmentFrequencies = ['monthly', 'weekly', 'biweekly'] as const;
export type InstallmentFrequency = (typeof installmentFrequencies)[number];

export const installmentStatuses = [
  'OPEN',
  'DUE_SOON',
  'OVERDUE',
  'PARTIALLY_PAID',
  'PAID',
  'RENEGOTIATED',
  'CANCELLED',
] as const;
export type InstallmentStatus = (typeof installmentStatuses)[number];

export const paymentMethods = [
  'PIX',
  'CASH',
  'CARD',
  'TRANSFER',
  'BOLETO',
  'OTHER',
] as const;
export type PaymentMethod = (typeof paymentMethods)[number];

export const signatureMethods = ['ON_DEVICE', 'QR_REMOTE', 'UPLOADED'] as const;
export type SignatureMethod = (typeof signatureMethods)[number];

export const lateFineTypes = ['fixed', 'percent'] as const;
export type LateFineType = (typeof lateFineTypes)[number];

export const paymentProviders = [
  'none',
  'pix_manual',
  'asaas',
  'mercadopago',
  'other',
] as const;
export type PaymentProvider = (typeof paymentProviders)[number];
