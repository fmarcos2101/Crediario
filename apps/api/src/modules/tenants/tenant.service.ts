import { HttpException, HttpStatus } from '@nestjs/common';
import {
  assertPasswordPolicy,
  normalizeEmail,
  type TenantStatus,
} from '@crediplus/shared';
import { v7 as uuidv7 } from 'uuid';
import { hashPassword, randomToken, sha256Hex } from '../../common/crypto';
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
    return runWithRls({ tenantId: null, isSuperAdmin: true }, () =>
      this.tenants.listTenants(),
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
    patch: Partial<TenantSettingsRecord>,
  ): Promise<TenantSettingsRecord> {
    return runWithRls({ tenantId, isSuperAdmin: false }, async () => {
      const current = await this.tenants.findSettings(tenantId);
      if (!current) {
        throw new HttpException(NOT_FOUND, HttpStatus.NOT_FOUND);
      }
      const next = { ...current, ...patch, tenantId };
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
    };
  }
}
