import type {
  CustomerStatus,
  PaymentProvider,
  TenantStatus,
  TenantUserStatus,
} from '@crediplus/shared';

export type TenantRecord = {
  id: string;
  name: string;
  status: TenantStatus;
  customerCount: number;
  saleCount: number;
  createdAt: Date;
  updatedAt: Date;
};

export type TenantSettingsRecord = {
  tenantId: string;
  timezone: string;
  locale: string;
  lateInterestEnabled: boolean;
  lateInterestMonthlyRate: string | null;
  lateFineEnabled: boolean;
  lateFineType: 'fixed' | 'percent' | null;
  lateFineValue: string | null;
  signatureOtpOnDevice: boolean;
  signatureOtpQr: boolean;
  reminderDaysBeforeDue: number;
  overdueNudgeDays: number;
  protestWarningDays: number;
  collectionResponseHours: number;
  msgDueReminderEnabled: boolean;
  msgDueReminderBody: string;
  msgOverdueEnabled: boolean;
  msgOverdueBody: string;
  msgProtestWarningEnabled: boolean;
  msgProtestWarningBody: string;
  msgPaymentReceivedEnabled: boolean;
  msgPaymentReceivedBody: string;
  paymentProvider: PaymentProvider;
  paymentConfigured: boolean;
  metaPhoneNumberId: string | null;
  metaWabaId: string | null;
  metaConfigured: boolean;
};

export type TenantSecretsRecord = {
  tenantId: string;
  paymentApiKeyCiphertext: string | null;
  paymentWebhookSecretCiphertext: string | null;
  metaAccessTokenCiphertext: string | null;
  metaAppSecretCiphertext: string | null;
};

export type PublicTenantSettings = TenantSettingsRecord;

export type TenantUserRecord = {
  id: string;
  tenantId: string;
  userId: string;
  role: string;
  status: TenantUserStatus;
};

export type TenantInviteRecord = {
  id: string;
  tenantId: string;
  email: string;
  tokenHash: string;
  expiresAt: Date;
  consumedAt: Date | null;
};

export type TenantMembership = {
  tenantId: string;
  tenantName: string;
  tenantStatus: TenantStatus;
  memberStatus: TenantUserStatus;
  role: string;
};

export type AdminTenantListItem = {
  id: string;
  name: string;
  status: TenantStatus;
  ownerEmail: string | null;
  createdAt: Date;
  lastAccessAt: Date | null;
  customerCount: number;
  saleCount: number;
  paymentConfigured: boolean;
  metaConfigured: boolean;
};

export type TenantRepository = {
  createTenant(record: TenantRecord): Promise<void>;
  findTenantById(id: string): Promise<TenantRecord | null>;
  listTenants(): Promise<AdminTenantListItem[]>;
  updateTenantStatus(id: string, status: TenantStatus, at: Date): Promise<void>;
  createSettings(settings: TenantSettingsRecord): Promise<void>;
  findSettings(tenantId: string): Promise<TenantSettingsRecord | null>;
  updateSettings(settings: TenantSettingsRecord): Promise<void>;
  upsertSecrets(secrets: TenantSecretsRecord): Promise<void>;
  findSecrets(tenantId: string): Promise<TenantSecretsRecord | null>;
  createTenantUser(record: TenantUserRecord): Promise<void>;
  findTenantUser(tenantId: string, userId: string): Promise<TenantUserRecord | null>;
  findMembershipByUserId(userId: string): Promise<TenantMembership | null>;
  updateTenantUserStatus(id: string, status: TenantUserStatus, at: Date): Promise<void>;
  createInvite(record: TenantInviteRecord): Promise<void>;
  findInviteByTokenHash(tokenHash: string): Promise<TenantInviteRecord | null>;
  consumeInvite(id: string, at: Date): Promise<void>;
  activatePendingMembers(tenantId: string, at: Date): Promise<void>;
};

export type CustomerRecord = {
  id: string;
  tenantId: string;
  name: string;
  phone: string | null;
  email: string | null;
  cpfHmac: string;
  cpfCiphertext: string;
  notes: string | null;
  status: CustomerStatus;
  createdAt: Date;
  updatedAt: Date;
};

export type CustomerRepository = {
  create(record: CustomerRecord): Promise<void>;
  update(record: CustomerRecord): Promise<void>;
  findById(tenantId: string, id: string): Promise<CustomerRecord | null>;
  findByCpfHmac(tenantId: string, cpfHmac: string): Promise<CustomerRecord | null>;
  list(
    tenantId: string,
    query: { q?: string; status?: CustomerStatus },
  ): Promise<CustomerRecord[]>;
};
