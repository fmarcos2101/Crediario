import type {
  AdminTenantListItem,
  TenantInviteRecord,
  TenantMembership,
  TenantRecord,
  TenantRepository,
  TenantSettingsRecord,
  TenantUserRecord,
} from './tenant.types';
import type { TenantStatus, TenantUserStatus } from '@crediplus/shared';

export class MemoryTenantRepository implements TenantRepository {
  tenants: TenantRecord[] = [];
  settings: TenantSettingsRecord[] = [];
  members: TenantUserRecord[] = [];
  invites: TenantInviteRecord[] = [];
  ownerEmails = new Map<string, string>();

  async createTenant(record: TenantRecord): Promise<void> {
    this.tenants.push({ ...record });
  }

  async findTenantById(id: string): Promise<TenantRecord | null> {
    return this.tenants.find((item) => item.id === id) ?? null;
  }

  async listTenants(): Promise<AdminTenantListItem[]> {
    return this.tenants.map((tenant) => ({
      id: tenant.id,
      name: tenant.name,
      status: tenant.status,
      ownerEmail: this.ownerEmails.get(tenant.id) ?? null,
      createdAt: tenant.createdAt,
    }));
  }

  async updateTenantStatus(id: string, status: TenantStatus, at: Date): Promise<void> {
    const tenant = this.tenants.find((item) => item.id === id);
    if (tenant) {
      tenant.status = status;
      tenant.updatedAt = at;
    }
  }

  async createSettings(settings: TenantSettingsRecord): Promise<void> {
    this.settings.push({ ...settings });
  }

  async findSettings(tenantId: string): Promise<TenantSettingsRecord | null> {
    return this.settings.find((item) => item.tenantId === tenantId) ?? null;
  }

  async updateSettings(settings: TenantSettingsRecord): Promise<void> {
    this.settings = this.settings.filter((item) => item.tenantId !== settings.tenantId);
    this.settings.push({ ...settings });
  }

  async createTenantUser(record: TenantUserRecord): Promise<void> {
    this.members.push({ ...record });
  }

  async findTenantUser(
    tenantId: string,
    userId: string,
  ): Promise<TenantUserRecord | null> {
    return (
      this.members.find((item) => item.tenantId === tenantId && item.userId === userId) ??
      null
    );
  }

  async findMembershipByUserId(userId: string): Promise<TenantMembership | null> {
    const member = this.members.find(
      (item) => item.userId === userId && item.status !== 'revoked',
    );
    if (!member) {
      return null;
    }
    const tenant = this.tenants.find((item) => item.id === member.tenantId);
    if (!tenant) {
      return null;
    }
    return {
      tenantId: tenant.id,
      tenantName: tenant.name,
      tenantStatus: tenant.status,
      memberStatus: member.status,
      role: member.role,
    };
  }

  async updateTenantUserStatus(
    id: string,
    status: TenantUserStatus,
    at: Date,
  ): Promise<void> {
    const member = this.members.find((item) => item.id === id);
    if (member) {
      member.status = status;
    }
    void at;
  }

  async createInvite(record: TenantInviteRecord): Promise<void> {
    this.invites.push({ ...record });
    this.ownerEmails.set(record.tenantId, record.email);
  }

  async findInviteByTokenHash(tokenHash: string): Promise<TenantInviteRecord | null> {
    return this.invites.find((item) => item.tokenHash === tokenHash) ?? null;
  }

  async consumeInvite(id: string, at: Date): Promise<void> {
    const invite = this.invites.find((item) => item.id === id);
    if (invite) {
      invite.consumedAt = at;
    }
  }

  async activatePendingMembers(tenantId: string, at: Date): Promise<void> {
    for (const member of this.members) {
      if (member.tenantId === tenantId && member.status === 'pending_activation') {
        member.status = 'active';
      }
    }
    void at;
  }
}
