import {
  and,
  applyRlsContext,
  desc,
  eq,
  tenantInvites,
  tenantSecrets,
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
  TenantSecretsRecord,
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
          customerCount: tenants.customerCount,
          saleCount: tenants.saleCount,
          paymentConfigured: tenantSettings.paymentConfigured,
          metaConfigured: tenantSettings.metaConfigured,
          memberEmail: users.email,
          inviteEmail: tenantInvites.email,
        })
        .from(tenants)
        .leftJoin(tenantSettings, eq(tenantSettings.tenantId, tenants.id))
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
            lastAccessAt: null,
            customerCount: row.customerCount,
            saleCount: row.saleCount,
            paymentConfigured: row.paymentConfigured ?? false,
            metaConfigured: row.metaConfigured ?? false,
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
          timezone: settings.timezone,
          locale: settings.locale,
          lateInterestEnabled: settings.lateInterestEnabled,
          lateInterestMonthlyRate: settings.lateInterestMonthlyRate,
          lateFineEnabled: settings.lateFineEnabled,
          lateFineType: settings.lateFineType,
          lateFineValue: settings.lateFineValue,
          signatureOtpOnDevice: settings.signatureOtpOnDevice,
          signatureOtpQr: settings.signatureOtpQr,
          reminderDaysBeforeDue: settings.reminderDaysBeforeDue,
          overdueNudgeDays: settings.overdueNudgeDays,
          protestWarningDays: settings.protestWarningDays,
          collectionResponseHours: settings.collectionResponseHours,
          msgDueReminderEnabled: settings.msgDueReminderEnabled,
          msgDueReminderBody: settings.msgDueReminderBody,
          msgOverdueEnabled: settings.msgOverdueEnabled,
          msgOverdueBody: settings.msgOverdueBody,
          msgProtestWarningEnabled: settings.msgProtestWarningEnabled,
          msgProtestWarningBody: settings.msgProtestWarningBody,
          msgPaymentReceivedEnabled: settings.msgPaymentReceivedEnabled,
          msgPaymentReceivedBody: settings.msgPaymentReceivedBody,
          paymentProvider: settings.paymentProvider,
          paymentConfigured: settings.paymentConfigured,
          metaPhoneNumberId: settings.metaPhoneNumberId,
          metaWabaId: settings.metaWabaId,
          metaConfigured: settings.metaConfigured,
          updatedAt: new Date(),
        })
        .where(eq(tenantSettings.tenantId, settings.tenantId));
    });
  }

  async upsertSecrets(secrets: TenantSecretsRecord): Promise<void> {
    await this.withRls(async (tx) => {
      await tx
        .insert(tenantSecrets)
        .values({
          tenantId: secrets.tenantId,
          paymentApiKeyCiphertext: secrets.paymentApiKeyCiphertext,
          paymentWebhookSecretCiphertext: secrets.paymentWebhookSecretCiphertext,
          metaAccessTokenCiphertext: secrets.metaAccessTokenCiphertext,
          metaAppSecretCiphertext: secrets.metaAppSecretCiphertext,
          updatedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: tenantSecrets.tenantId,
          set: {
            paymentApiKeyCiphertext: secrets.paymentApiKeyCiphertext,
            paymentWebhookSecretCiphertext: secrets.paymentWebhookSecretCiphertext,
            metaAccessTokenCiphertext: secrets.metaAccessTokenCiphertext,
            metaAppSecretCiphertext: secrets.metaAppSecretCiphertext,
            updatedAt: new Date(),
          },
        });
    });
  }

  async findSecrets(tenantId: string): Promise<TenantSecretsRecord | null> {
    return this.withRls(async (tx) => {
      const rows = await tx
        .select()
        .from(tenantSecrets)
        .where(eq(tenantSecrets.tenantId, tenantId))
        .limit(1);
      const row = rows[0];
      if (!row) {
        return null;
      }
      return {
        tenantId: row.tenantId,
        paymentApiKeyCiphertext: row.paymentApiKeyCiphertext,
        paymentWebhookSecretCiphertext: row.paymentWebhookSecretCiphertext,
        metaAccessTokenCiphertext: row.metaAccessTokenCiphertext,
        metaAppSecretCiphertext: row.metaAppSecretCiphertext,
      };
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
      reminderDaysBeforeDue: row.reminderDaysBeforeDue,
      overdueNudgeDays: row.overdueNudgeDays,
      protestWarningDays: row.protestWarningDays,
      collectionResponseHours: row.collectionResponseHours,
      msgDueReminderEnabled: row.msgDueReminderEnabled,
      msgDueReminderBody: row.msgDueReminderBody,
      msgOverdueEnabled: row.msgOverdueEnabled,
      msgOverdueBody: row.msgOverdueBody,
      msgProtestWarningEnabled: row.msgProtestWarningEnabled,
      msgProtestWarningBody: row.msgProtestWarningBody,
      msgPaymentReceivedEnabled: row.msgPaymentReceivedEnabled,
      msgPaymentReceivedBody: row.msgPaymentReceivedBody,
      paymentProvider: row.paymentProvider,
      paymentConfigured: row.paymentConfigured,
      metaPhoneNumberId: row.metaPhoneNumberId,
      metaWabaId: row.metaWabaId,
      metaConfigured: row.metaConfigured,
    };
  }
}
