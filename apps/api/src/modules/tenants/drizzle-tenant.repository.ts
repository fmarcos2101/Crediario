import {
  and,
  applyRlsContext,
  desc,
  eq,
  tenantInvites,
  tenantSettings,
  tenantUsers,
  tenants,
  users,
  type Database,
} from '@crediplus/db';
import type { TenantStatus, TenantUserStatus } from '@crediplus/shared';
import { getRlsContext } from './rls-als';
import type {
  AdminTenantListItem,
  TenantInviteRecord,
  TenantMembership,
  TenantRecord,
  TenantRepository,
  TenantSettingsRecord,
  TenantUserRecord,
} from './tenant.types';

export class DrizzleTenantRepository implements TenantRepository {
  constructor(private readonly db: Database) {}

  private async withRls<T>(fn: (tx: Database) => Promise<T>): Promise<T> {
    return this.db.transaction(async (tx) => {
      await applyRlsContext(tx, getRlsContext());
      return fn(tx as unknown as Database);
    });
  }

  async createTenant(record: TenantRecord): Promise<void> {
    await this.withRls(async (tx) => {
      await tx.insert(tenants).values(record);
    });
  }

  async findTenantById(id: string): Promise<TenantRecord | null> {
    return this.withRls(async (tx) => {
      const rows = await tx.select().from(tenants).where(eq(tenants.id, id)).limit(1);
      return rows[0] ?? null;
    });
  }

  async listTenants(): Promise<AdminTenantListItem[]> {
    return this.withRls(async (tx) => {
      const rows = await tx
        .select({
          id: tenants.id,
          name: tenants.name,
          status: tenants.status,
          createdAt: tenants.createdAt,
          memberEmail: users.email,
          inviteEmail: tenantInvites.email,
        })
        .from(tenants)
        .leftJoin(tenantUsers, eq(tenantUsers.tenantId, tenants.id))
        .leftJoin(users, eq(users.id, tenantUsers.userId))
        .leftJoin(tenantInvites, eq(tenantInvites.tenantId, tenants.id))
        .orderBy(desc(tenants.createdAt));

      const seen = new Map<string, AdminTenantListItem>();
      for (const row of rows) {
        const ownerEmail = row.memberEmail ?? row.inviteEmail;
        const current = seen.get(row.id);
        if (!current) {
          seen.set(row.id, {
            id: row.id,
            name: row.name,
            status: row.status,
            ownerEmail,
            createdAt: row.createdAt,
          });
        } else if (!current.ownerEmail && ownerEmail) {
          current.ownerEmail = ownerEmail;
        }
      }
      return [...seen.values()];
    });
  }

  async updateTenantStatus(id: string, status: TenantStatus, at: Date): Promise<void> {
    await this.withRls(async (tx) => {
      await tx.update(tenants).set({ status, updatedAt: at }).where(eq(tenants.id, id));
    });
  }

  async createSettings(settings: TenantSettingsRecord): Promise<void> {
    await this.withRls(async (tx) => {
      await tx.insert(tenantSettings).values(settings);
    });
  }

  async findSettings(tenantId: string): Promise<TenantSettingsRecord | null> {
    return this.withRls(async (tx) => {
      const rows = await tx
        .select()
        .from(tenantSettings)
        .where(eq(tenantSettings.tenantId, tenantId))
        .limit(1);
      return rows[0] ? this.mapSettings(rows[0]) : null;
    });
  }

  async updateSettings(settings: TenantSettingsRecord): Promise<void> {
    await this.withRls(async (tx) => {
      await tx
        .update(tenantSettings)
        .set({
          lateInterestEnabled: settings.lateInterestEnabled,
          lateInterestMonthlyRate: settings.lateInterestMonthlyRate,
          lateFineEnabled: settings.lateFineEnabled,
          lateFineType: settings.lateFineType,
          lateFineValue: settings.lateFineValue,
          signatureOtpOnDevice: settings.signatureOtpOnDevice,
          signatureOtpQr: settings.signatureOtpQr,
          updatedAt: new Date(),
        })
        .where(eq(tenantSettings.tenantId, settings.tenantId));
    });
  }

  async createTenantUser(record: TenantUserRecord): Promise<void> {
    await this.withRls(async (tx) => {
      await tx.insert(tenantUsers).values(record);
    });
  }

  async findTenantUser(
    tenantId: string,
    userId: string,
  ): Promise<TenantUserRecord | null> {
    return this.withRls(async (tx) => {
      const rows = await tx
        .select()
        .from(tenantUsers)
        .where(and(eq(tenantUsers.tenantId, tenantId), eq(tenantUsers.userId, userId)))
        .limit(1);
      return rows[0] ?? null;
    });
  }

  async findMembershipByUserId(userId: string): Promise<TenantMembership | null> {
    return this.withRls(async (tx) => {
      const rows = await tx
        .select({
          tenantId: tenants.id,
          tenantName: tenants.name,
          tenantStatus: tenants.status,
          memberStatus: tenantUsers.status,
          role: tenantUsers.role,
        })
        .from(tenantUsers)
        .innerJoin(tenants, eq(tenants.id, tenantUsers.tenantId))
        .where(eq(tenantUsers.userId, userId))
        .limit(1);
      const row = rows[0];
      return row ?? null;
    });
  }

  async updateTenantUserStatus(
    id: string,
    status: TenantUserStatus,
    at: Date,
  ): Promise<void> {
    await this.withRls(async (tx) => {
      await tx
        .update(tenantUsers)
        .set({ status, updatedAt: at })
        .where(eq(tenantUsers.id, id));
    });
  }

  async createInvite(record: TenantInviteRecord): Promise<void> {
    await this.withRls(async (tx) => {
      await tx.insert(tenantInvites).values(record);
    });
  }

  async findInviteByTokenHash(tokenHash: string): Promise<TenantInviteRecord | null> {
    return this.withRls(async (tx) => {
      const rows = await tx
        .select()
        .from(tenantInvites)
        .where(eq(tenantInvites.tokenHash, tokenHash))
        .limit(1);
      return rows[0] ?? null;
    });
  }

  async consumeInvite(id: string, at: Date): Promise<void> {
    await this.withRls(async (tx) => {
      await tx
        .update(tenantInvites)
        .set({ consumedAt: at })
        .where(eq(tenantInvites.id, id));
    });
  }

  async activatePendingMembers(tenantId: string, at: Date): Promise<void> {
    await this.withRls(async (tx) => {
      await tx
        .update(tenantUsers)
        .set({ status: 'active', updatedAt: at })
        .where(
          and(
            eq(tenantUsers.tenantId, tenantId),
            eq(tenantUsers.status, 'pending_activation'),
          ),
        );
    });
  }

  private mapSettings(row: typeof tenantSettings.$inferSelect): TenantSettingsRecord {
    return {
      tenantId: row.tenantId,
      timezone: row.timezone,
      locale: row.locale,
      lateInterestEnabled: row.lateInterestEnabled,
      lateInterestMonthlyRate: row.lateInterestMonthlyRate,
      lateFineEnabled: row.lateFineEnabled,
      lateFineType: row.lateFineType,
      lateFineValue: row.lateFineValue,
      signatureOtpOnDevice: row.signatureOtpOnDevice,
      signatureOtpQr: row.signatureOtpQr,
    };
  }
}
