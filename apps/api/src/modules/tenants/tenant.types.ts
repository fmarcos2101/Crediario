import type { TenantStatus, TenantUserStatus } from '@crediplus/shared';

export type TenantRecord = {
  id: string;
  name: string;
  status: TenantStatus;
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
};

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
};

export type TenantRepository = {
  createTenant(record: TenantRecord): Promise<void>;
  findTenantById(id: string): Promise<TenantRecord | null>;
  listTenants(): Promise<AdminTenantListItem[]>;
  updateTenantStatus(id: string, status: TenantStatus, at: Date): Promise<void>;
  createSettings(settings: TenantSettingsRecord): Promise<void>;
  findSettings(tenantId: string): Promise<TenantSettingsRecord | null>;
  updateSettings(settings: TenantSettingsRecord): Promise<void>;
  createTenantUser(record: TenantUserRecord): Promise<void>;
  findTenantUser(tenantId: string, userId: string): Promise<TenantUserRecord | null>;
  findMembershipByUserId(userId: string): Promise<TenantMembership | null>;
  updateTenantUserStatus(id: string, status: TenantUserStatus, at: Date): Promise<void>;
  createInvite(record: TenantInviteRecord): Promise<void>;
  findInviteByTokenHash(tokenHash: string): Promise<TenantInviteRecord | null>;
  consumeInvite(id: string, at: Date): Promise<void>;
  activatePendingMembers(tenantId: string, at: Date): Promise<void>;
};
