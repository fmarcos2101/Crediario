import { HttpException, HttpStatus } from '@nestjs/common';
import {
  DEFAULT_MSG_DUE_REMINDER,
  DEFAULT_MSG_OVERDUE,
  DEFAULT_MSG_PAYMENT_RECEIVED,
  DEFAULT_MSG_PROTEST_WARNING,
  assertPasswordPolicy,
  normalizeEmail,
  type TenantStatus,
  type UpdateTenantSettingsInput,
} from '@crediplus/shared';
import { v7 as uuidv7 } from 'uuid';
import { encryptString, hashPassword, randomToken, sha256Hex } from '../../common/crypto';
import type { AuthRepository } from '../auth/auth.types';
import type { EmailProvider } from '../email/email.provider';
import { runWithRls } from './rls-als';
import type {
  AdminTenantListItem,
  TenantRepository,
  TenantSettingsRecord,
} from './tenant.types';

const INVITE_TTL_MS = 48 * 60 * 60 * 1000;
const NOT_FOUND = 'Recurso não encontrado.';

export class TenantService {
  constructor(
    private readonly tenants: TenantRepository,
    private readonly users: AuthRepository,
    private readonly email: EmailProvider,
    private readonly appOrigin: string,
    private readonly encryptionKey: string | undefined = undefined,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async createCompany(
    name: string,
    ownerEmailRaw: string,
  ): Promise<{ tenantId: string; inviteSentTo: string }> {
    const ownerEmail = normalizeEmail(ownerEmailRaw);
    const now = this.now();
    const tenantId = uuidv7();
    const inviteToken = randomToken();

    await runWithRls({ tenantId, isSuperAdmin: true }, async () => {
      await this.tenants.createTenant({
        id: tenantId,
        name: name.trim(),
        status: 'pending_setup',
        customerCount: 0,
        createdAt: now,
        updatedAt: now,
      });
      await this.tenants.createSettings(this.defaultSettings(tenantId));
      await this.tenants.createInvite({
        id: uuidv7(),
        tenantId,
        email: ownerEmail,
        tokenHash: sha256Hex(inviteToken),
        expiresAt: new Date(now.getTime() + INVITE_TTL_MS),
        consumedAt: null,
      });
    });

    const inviteUrl = `${this.appOrigin}/convite?token=${encodeURIComponent(inviteToken)}`;
    await this.email.send({
      to: ownerEmail,
      subject: 'Convite CrediPlus',
      text: `Você foi convidado para ${name.trim()}.\nDefina sua senha neste link (48h):\n${inviteUrl}\n\nO acesso só funciona depois da liberação do Super Admin.`,
    });

    return { tenantId, inviteSentTo: ownerEmail };
  }

  async listCompanies(): Promise<AdminTenantListItem[]> {
    const companies = await runWithRls({ tenantId: null, isSuperAdmin: true }, () =>
      this.tenants.listTenants(),
    );
    return Promise.all(
      companies.map(async (company) => ({
        ...company,
        lastAccessAt: await this.users.findLastAccessByTenant(company.id),
      })),
    );
  }

  async setCompanyStatus(tenantId: string, status: TenantStatus): Promise<void> {
    await runWithRls({ tenantId, isSuperAdmin: true }, async () => {
      const tenant = await this.tenants.findTenantById(tenantId);
      if (!tenant) {
        throw new HttpException(NOT_FOUND, HttpStatus.NOT_FOUND);
      }
      const now = this.now();
      await this.tenants.updateTenantStatus(tenantId, status, now);
      if (status === 'active') {
        await this.tenants.activatePendingMembers(tenantId, now);
      }
      if (status === 'suspended' || status === 'archived') {
        await this.users.revokeSessionsByTenant(tenantId, now);
      }
    });
  }

  async acceptInvite(token: string, password: string): Promise<void> {
    assertPasswordPolicy(password);
    const tokenHash = sha256Hex(token);
    const invite = await runWithRls(
      { tenantId: null, isSuperAdmin: false, inviteTokenHash: tokenHash },
      () => this.tenants.findInviteByTokenHash(tokenHash),
    );
    if (!invite || invite.consumedAt || invite.expiresAt <= this.now()) {
      throw new HttpException('Convite inválido ou expirado.', HttpStatus.BAD_REQUEST);
    }

    await runWithRls(
      {
        tenantId: invite.tenantId,
        isSuperAdmin: true,
        inviteTokenHash: tokenHash,
      },
      async () => {
        const now = this.now();
        let user = await this.users.findUserByEmail(invite.email);
        if (!user) {
          const userId = uuidv7();
          await this.users.createUser({
            id: userId,
            email: invite.email,
            passwordHash: await hashPassword(password),
            isSuperAdmin: false,
            status: 'active',
            emailVerifiedAt: now,
          });
          user = await this.users.findUserById(userId);
        } else {
          const existing = await this.tenants.findMembershipByUserId(user.id);
          if (existing && existing.tenantId !== invite.tenantId) {
            throw new HttpException(
              'Este e-mail já está vinculado a outra empresa.',
              HttpStatus.CONFLICT,
            );
          }
          await this.users.updatePassword(user.id, await hashPassword(password), now);
        }
        if (!user) {
          throw new HttpException(
            'Falha ao criar usuário.',
            HttpStatus.INTERNAL_SERVER_ERROR,
          );
        }
        const member = await this.tenants.findTenantUser(invite.tenantId, user.id);
        if (!member) {
          await this.tenants.createTenantUser({
            id: uuidv7(),
            tenantId: invite.tenantId,
            userId: user.id,
            role: 'OWNER',
            status: 'pending_activation',
          });
        }
        await this.tenants.updateTenantStatus(invite.tenantId, 'pending_activation', now);
        await this.tenants.consumeInvite(invite.id, now);
      },
    );
  }

  async getSettingsForTenant(tenantId: string): Promise<TenantSettingsRecord> {
    const settings = await runWithRls({ tenantId, isSuperAdmin: false }, () =>
      this.tenants.findSettings(tenantId),
    );
    if (!settings) {
      throw new HttpException(NOT_FOUND, HttpStatus.NOT_FOUND);
    }
    return settings;
  }

  async updateSettingsForTenant(
    tenantId: string,
    patch: UpdateTenantSettingsInput,
  ): Promise<TenantSettingsRecord> {
    return runWithRls({ tenantId, isSuperAdmin: false }, async () => {
      const current = await this.tenants.findSettings(tenantId);
      if (!current) {
        throw new HttpException(NOT_FOUND, HttpStatus.NOT_FOUND);
      }
      const secretPatch = await this.applySecretPatch(tenantId, patch);
      const next: TenantSettingsRecord = {
        ...current,
        ...this.pickSettingsPatch(patch),
        tenantId,
        paymentConfigured: secretPatch.paymentConfigured,
        metaConfigured: secretPatch.metaConfigured,
      };
      await this.tenants.updateSettings(next);
      return next;
    });
  }

  async peekMembership(userId: string) {
    return runWithRls({ tenantId: null, isSuperAdmin: false, userId }, () =>
      this.tenants.findMembershipByUserId(userId),
    );
  }

  async requireActiveMembership(userId: string) {
    const membership = await runWithRls(
      { tenantId: null, isSuperAdmin: false, userId },
      () => this.tenants.findMembershipByUserId(userId),
    );
    if (
      !membership ||
      membership.memberStatus !== 'active' ||
      membership.tenantStatus !== 'active'
    ) {
      throw new HttpException(
        'Acesso ainda não liberado para esta empresa.',
        HttpStatus.FORBIDDEN,
      );
    }
    return membership;
  }

  private defaultSettings(tenantId: string): TenantSettingsRecord {
    return {
      tenantId,
      timezone: 'America/Sao_Paulo',
      locale: 'pt-BR',
      lateInterestEnabled: false,
      lateInterestMonthlyRate: null,
      lateFineEnabled: false,
      lateFineType: null,
      lateFineValue: null,
      signatureOtpOnDevice: false,
      signatureOtpQr: true,
      reminderDaysBeforeDue: 3,
      overdueNudgeDays: 1,
      protestWarningDays: 15,
      collectionResponseHours: 24,
      msgDueReminderEnabled: true,
      msgDueReminderBody: DEFAULT_MSG_DUE_REMINDER,
      msgOverdueEnabled: true,
      msgOverdueBody: DEFAULT_MSG_OVERDUE,
      msgProtestWarningEnabled: true,
      msgProtestWarningBody: DEFAULT_MSG_PROTEST_WARNING,
      msgPaymentReceivedEnabled: true,
      msgPaymentReceivedBody: DEFAULT_MSG_PAYMENT_RECEIVED,
      paymentProvider: 'none',
      paymentConfigured: false,
      metaPhoneNumberId: null,
      metaWabaId: null,
      metaConfigured: false,
    };
  }

  private pickSettingsPatch(
    patch: UpdateTenantSettingsInput,
  ): Partial<TenantSettingsRecord> {
    const next: Partial<TenantSettingsRecord> = {};
    const assign = <K extends keyof TenantSettingsRecord>(
      key: K,
      value: TenantSettingsRecord[K] | undefined,
    ) => {
      if (value !== undefined) {
        next[key] = value;
      }
    };
    assign('timezone', patch.timezone);
    assign('locale', patch.locale);
    assign('lateInterestEnabled', patch.lateInterestEnabled);
    assign('lateInterestMonthlyRate', patch.lateInterestMonthlyRate);
    assign('lateFineEnabled', patch.lateFineEnabled);
    assign('lateFineType', patch.lateFineType);
    assign('lateFineValue', patch.lateFineValue);
    assign('signatureOtpOnDevice', patch.signatureOtpOnDevice);
    assign('signatureOtpQr', patch.signatureOtpQr);
    assign('reminderDaysBeforeDue', patch.reminderDaysBeforeDue);
    assign('overdueNudgeDays', patch.overdueNudgeDays);
    assign('protestWarningDays', patch.protestWarningDays);
    assign('collectionResponseHours', patch.collectionResponseHours);
    assign('msgDueReminderEnabled', patch.msgDueReminderEnabled);
    assign('msgDueReminderBody', patch.msgDueReminderBody);
    assign('msgOverdueEnabled', patch.msgOverdueEnabled);
    assign('msgOverdueBody', patch.msgOverdueBody);
    assign('msgProtestWarningEnabled', patch.msgProtestWarningEnabled);
    assign('msgProtestWarningBody', patch.msgProtestWarningBody);
    assign('msgPaymentReceivedEnabled', patch.msgPaymentReceivedEnabled);
    assign('msgPaymentReceivedBody', patch.msgPaymentReceivedBody);
    assign('paymentProvider', patch.paymentProvider);
    assign('metaPhoneNumberId', patch.metaPhoneNumberId);
    assign('metaWabaId', patch.metaWabaId);
    return next;
  }

  private async applySecretPatch(
    tenantId: string,
    patch: UpdateTenantSettingsInput,
  ): Promise<{ paymentConfigured: boolean; metaConfigured: boolean }> {
    const currentSettings = await this.tenants.findSettings(tenantId);
    const current = (await this.tenants.findSecrets(tenantId)) ?? {
      tenantId,
      paymentApiKeyCiphertext: null,
      paymentWebhookSecretCiphertext: null,
      metaAccessTokenCiphertext: null,
      metaAppSecretCiphertext: null,
    };
    let paymentKey = current.paymentApiKeyCiphertext;
    let paymentWebhook = current.paymentWebhookSecretCiphertext;
    let metaToken = current.metaAccessTokenCiphertext;
    let metaSecret = current.metaAppSecretCiphertext;

    const wantsPayment =
      patch.paymentApiKey !== undefined ||
      patch.paymentWebhookSecret !== undefined ||
      patch.clearPaymentSecrets === true;
    const wantsMeta =
      patch.metaAccessToken !== undefined ||
      patch.metaAppSecret !== undefined ||
      patch.clearMetaSecrets === true;

    if ((wantsPayment || wantsMeta) && !this.encryptionKey) {
      throw new HttpException(
        'Criptografia não configurada para guardar chaves de API.',
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }

    if (patch.clearPaymentSecrets) {
      paymentKey = null;
      paymentWebhook = null;
    } else {
      if (patch.paymentApiKey) {
        paymentKey = encryptString(patch.paymentApiKey, this.encryptionKey!);
      }
      if (patch.paymentWebhookSecret) {
        paymentWebhook = encryptString(patch.paymentWebhookSecret, this.encryptionKey!);
      }
    }

    if (patch.clearMetaSecrets) {
      metaToken = null;
      metaSecret = null;
    } else {
      if (patch.metaAccessToken) {
        metaToken = encryptString(patch.metaAccessToken, this.encryptionKey!);
      }
      if (patch.metaAppSecret) {
        metaSecret = encryptString(patch.metaAppSecret, this.encryptionKey!);
      }
    }

    if (wantsPayment || wantsMeta) {
      await this.tenants.upsertSecrets({
        tenantId,
        paymentApiKeyCiphertext: paymentKey,
        paymentWebhookSecretCiphertext: paymentWebhook,
        metaAccessTokenCiphertext: metaToken,
        metaAppSecretCiphertext: metaSecret,
      });
    }

    return {
      paymentConfigured:
        patch.clearPaymentSecrets ||
        patch.paymentApiKey !== undefined ||
        patch.paymentWebhookSecret !== undefined
          ? Boolean(paymentKey)
          : (currentSettings?.paymentConfigured ?? false),
      metaConfigured:
        patch.clearMetaSecrets ||
        patch.metaAccessToken !== undefined ||
        patch.metaAppSecret !== undefined
          ? Boolean(metaToken)
          : (currentSettings?.metaConfigured ?? false),
    };
  }
}
