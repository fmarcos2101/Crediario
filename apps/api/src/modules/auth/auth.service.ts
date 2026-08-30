import { HttpException, HttpStatus } from '@nestjs/common';
import { assertPasswordPolicy, normalizeEmail, type PublicUser } from '@crediplus/shared';
import { Secret, TOTP } from 'otpauth';
import { v7 as uuidv7 } from 'uuid';
import {
  decryptString,
  encryptString,
  hashPassword,
  randomToken,
  sha256Hex,
  verifyPassword,
} from '../../common/crypto';
import { MemoryRateLimiter } from '../../common/rate-limit';
import type { AuthRepository, SessionRecord, UserRecord } from './auth.types';
import { toPublicUser } from './auth.types';
import type { EmailProvider } from '../email/email.provider';

const INVALID = 'Credenciais inválidas.';
const RATE_LIMITED = 'Muitas tentativas. Tente novamente em alguns minutos.';
const TOTP_INVALID = 'Código inválido.';
const MAX_TOTP_ATTEMPTS = 5;
const CHALLENGE_TTL_MS = 5 * 60 * 1000;
const RESET_TTL_MS = 60 * 60 * 1000;
const IDLE_TENANT_MS = 12 * 60 * 60 * 1000;

export type AuthEnv = {
  APP_ORIGIN: string;
  APP_ENCRYPTION_KEY?: string | undefined;
  SESSION_TTL_HOURS: number;
  SUPERADMIN_SESSION_TTL_HOURS: number;
  SUPERADMIN_IDLE_MINUTES: number;
};

export type LoginContext = {
  ip: string | null;
  userAgent: string | null;
};

export type LoginSuccess = {
  kind: 'session';
  user: PublicUser;
  sessionToken: string;
  csrfToken: string;
  expiresAt: Date;
};

export type LoginTotpRequired = {
  kind: 'totp';
  challengeToken: string;
};

export class AuthService {
  private dummyHash: string | undefined;

  constructor(
    private readonly repo: AuthRepository,
    private readonly env: AuthEnv,
    private readonly email: EmailProvider,
    private readonly loginLimiter = new MemoryRateLimiter(15 * 60 * 1000, 5),
    private readonly resetLimiter = new MemoryRateLimiter(60 * 60 * 1000, 5),
    private readonly now: () => Date = () => new Date(),
  ) {}

  async login(
    emailRaw: string,
    password: string,
    ctx: LoginContext,
  ): Promise<LoginSuccess | LoginTotpRequired> {
    const email = normalizeEmail(emailRaw);
    const rateKey = `${ctx.ip ?? 'unknown'}:${email}`;
    if (!this.loginLimiter.consume(rateKey, this.now().getTime())) {
      throw new HttpException(RATE_LIMITED, HttpStatus.TOO_MANY_REQUESTS);
    }

    const user = await this.repo.findUserByEmail(email);
    const hash = user?.passwordHash ?? (await this.getDummyHash());
    const ok = await verifyPassword(hash, password);

    if (!user || !ok || user.status !== 'active') {
      await this.repo.recordLoginAttempt({
        id: uuidv7(),
        email,
        ipAddress: ctx.ip,
        success: false,
        createdAt: this.now(),
      });
      throw new HttpException(INVALID, HttpStatus.UNAUTHORIZED);
    }

    await this.repo.recordLoginAttempt({
      id: uuidv7(),
      email,
      ipAddress: ctx.ip,
      success: true,
      createdAt: this.now(),
    });

    if (user.isSuperAdmin) {
      const totp = await this.repo.findTotp(user.id);
      if (!totp) {
        throw new HttpException(
          '2FA obrigatório não está configurado para esta conta.',
          HttpStatus.FORBIDDEN,
        );
      }
      const challengeToken = randomToken();
      await this.repo.createChallenge({
        id: uuidv7(),
        userId: user.id,
        tokenHash: sha256Hex(challengeToken),
        expiresAt: new Date(this.now().getTime() + CHALLENGE_TTL_MS),
        attempts: 0,
        consumedAt: null,
      });
      await this.security(user.id, 'LOGIN_TOTP_CHALLENGE', ctx);
      return { kind: 'totp', challengeToken };
    }

    return this.issueSession(user, ctx);
  }

  async verifyTotp(
    challengeToken: string,
    code: string,
    ctx: LoginContext,
  ): Promise<LoginSuccess> {
    const challenge = await this.repo.findChallengeByTokenHash(sha256Hex(challengeToken));
    if (!challenge || challenge.consumedAt || challenge.expiresAt <= this.now()) {
      throw new HttpException(TOTP_INVALID, HttpStatus.UNAUTHORIZED);
    }

    const attempts = await this.repo.incrementChallengeAttempts(challenge.id);
    if (attempts > MAX_TOTP_ATTEMPTS) {
      await this.repo.consumeChallenge(challenge.id, this.now());
      throw new HttpException(RATE_LIMITED, HttpStatus.TOO_MANY_REQUESTS);
    }

    const user = await this.repo.findUserById(challenge.userId);
    const totp = user ? await this.repo.findTotp(user.id) : null;
    const key = this.env.APP_ENCRYPTION_KEY;
    if (!user || user.status !== 'active' || !totp || !key) {
      throw new HttpException(TOTP_INVALID, HttpStatus.UNAUTHORIZED);
    }

    const secret = decryptString(totp.secretCiphertext, key);
    const totpCheck = new TOTP({
      issuer: 'CrediPlus',
      label: user.email,
      algorithm: 'SHA1',
      digits: 6,
      period: 30,
      secret: Secret.fromBase32(secret),
    });

    const delta = totpCheck.validate({ token: code, window: 1 });
    if (delta === null) {
      throw new HttpException(TOTP_INVALID, HttpStatus.UNAUTHORIZED);
    }

    await this.repo.consumeChallenge(challenge.id, this.now());
    return this.issueSession(user, ctx);
  }

  async logout(sessionId: string, ctx: LoginContext, userId: string): Promise<void> {
    await this.repo.revokeSession(sessionId, this.now());
    await this.security(userId, 'LOGOUT', ctx);
  }

  async resolveSession(sessionToken: string): Promise<{
    user: PublicUser;
    session: SessionRecord;
  } | null> {
    const session = await this.repo.findSessionByTokenHash(sha256Hex(sessionToken));
    if (!session || session.revokedAt) {
      return null;
    }
    const now = this.now();
    if (session.expiresAt <= now || session.idleExpiresAt <= now) {
      await this.repo.revokeSession(session.id, now);
      return null;
    }
    const user = await this.repo.findUserById(session.userId);
    if (!user || user.status !== 'active') {
      return null;
    }
    const idleMs = user.isSuperAdmin
      ? this.env.SUPERADMIN_IDLE_MINUTES * 60 * 1000
      : IDLE_TENANT_MS;
    await this.repo.touchSession(session.id, now, new Date(now.getTime() + idleMs));
    return { user: toPublicUser(user), session };
  }

  async forgotPassword(emailRaw: string, ctx: LoginContext): Promise<void> {
    const email = normalizeEmail(emailRaw);
    if (
      !this.resetLimiter.consume(`${ctx.ip ?? 'unknown'}:${email}`, this.now().getTime())
    ) {
      return;
    }
    const user = await this.repo.findUserByEmail(email);
    if (!user || user.status !== 'active') {
      return;
    }
    const token = randomToken();
    await this.repo.createPasswordReset({
      id: uuidv7(),
      userId: user.id,
      tokenHash: sha256Hex(token),
      expiresAt: new Date(this.now().getTime() + RESET_TTL_MS),
      consumedAt: null,
    });
    const resetUrl = `${this.env.APP_ORIGIN}/redefinir-senha?token=${encodeURIComponent(token)}`;
    await this.email.send({
      to: user.email,
      subject: 'Redefinição de senha — CrediPlus',
      text: `Use este link em até 60 minutos:\n${resetUrl}\n\nSe você não pediu isso, ignore o e-mail.`,
    });
    await this.security(user.id, 'PASSWORD_RESET_REQUESTED', ctx);
  }

  async resetPassword(token: string, password: string, ctx: LoginContext): Promise<void> {
    assertPasswordPolicy(password);
    const record = await this.repo.findPasswordResetByTokenHash(sha256Hex(token));
    if (!record || record.consumedAt || record.expiresAt <= this.now()) {
      throw new HttpException('Link inválido ou expirado.', HttpStatus.BAD_REQUEST);
    }
    const user = await this.repo.findUserById(record.userId);
    if (!user || user.status !== 'active') {
      throw new HttpException('Link inválido ou expirado.', HttpStatus.BAD_REQUEST);
    }
    await this.repo.consumePasswordReset(record.id, this.now());
    await this.repo.updatePassword(user.id, await hashPassword(password), this.now());
    await this.repo.revokeAllUserSessions(user.id, this.now());
    await this.security(user.id, 'PASSWORD_CHANGED', ctx);
  }

  async bootstrapSuperAdmin(
    emailRaw: string,
    password: string,
  ): Promise<{ email: string; otpauthUrl: string }> {
    assertPasswordPolicy(password);
    const email = normalizeEmail(emailRaw);
    const existing = await this.repo.findUserByEmail(email);
    if (existing) {
      throw new Error('Já existe um usuário com este e-mail.');
    }
    const key = this.env.APP_ENCRYPTION_KEY;
    if (!key) {
      throw new Error('APP_ENCRYPTION_KEY é obrigatória para o bootstrap.');
    }
    const now = this.now();
    const userId = uuidv7();
    await this.repo.createUser({
      id: userId,
      email,
      passwordHash: await hashPassword(password),
      isSuperAdmin: true,
      status: 'active',
      emailVerifiedAt: now,
    });
    const secret = new Secret({ size: 20 });
    const totp = new TOTP({
      issuer: 'CrediPlus',
      label: email,
      algorithm: 'SHA1',
      digits: 6,
      period: 30,
      secret,
    });
    await this.repo.upsertTotp(
      { userId, secretCiphertext: encryptString(secret.base32, key) },
      now,
    );
    return { email, otpauthUrl: totp.toString() };
  }

  private async issueSession(user: UserRecord, ctx: LoginContext): Promise<LoginSuccess> {
    const now = this.now();
    const ttlHours = user.isSuperAdmin
      ? this.env.SUPERADMIN_SESSION_TTL_HOURS
      : this.env.SESSION_TTL_HOURS;
    const idleMs = user.isSuperAdmin
      ? this.env.SUPERADMIN_IDLE_MINUTES * 60 * 1000
      : IDLE_TENANT_MS;
    const sessionToken = randomToken();
    const csrfToken = randomToken();
    const expiresAt = new Date(now.getTime() + ttlHours * 60 * 60 * 1000);
    await this.repo.createSession({
      id: uuidv7(),
      userId: user.id,
      tokenHash: sha256Hex(sessionToken),
      csrfTokenHash: sha256Hex(csrfToken),
      expiresAt,
      idleExpiresAt: new Date(now.getTime() + idleMs),
      lastUsedAt: now,
      revokedAt: null,
    });
    await this.security(user.id, 'LOGIN', ctx);
    return {
      kind: 'session',
      user: toPublicUser(user),
      sessionToken,
      csrfToken,
      expiresAt,
    };
  }

  private async security(userId: string, type: string, ctx: LoginContext): Promise<void> {
    await this.repo.recordSecurityEvent({
      id: uuidv7(),
      userId,
      type,
      ipAddress: ctx.ip,
      userAgent: ctx.userAgent,
      metadata: null,
      createdAt: this.now(),
    });
  }

  private async getDummyHash(): Promise<string> {
    if (!this.dummyHash) {
      this.dummyHash = await hashPassword('not-a-real-user-dummy-password');
    }
    return this.dummyHash;
  }
}
