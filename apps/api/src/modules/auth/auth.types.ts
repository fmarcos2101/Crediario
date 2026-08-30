import type { PublicUser } from '@crediplus/shared';

export type UserRecord = {
  id: string;
  email: string;
  passwordHash: string;
  isSuperAdmin: boolean;
  status: 'active' | 'disabled';
  emailVerifiedAt: Date | null;
};

export type SessionRecord = {
  id: string;
  userId: string;
  tokenHash: string;
  csrfTokenHash: string;
  expiresAt: Date;
  idleExpiresAt: Date;
  lastUsedAt: Date;
  revokedAt: Date | null;
  tenantId: string | null;
};

export type TotpRecord = {
  userId: string;
  secretCiphertext: string;
};

export type ChallengeRecord = {
  id: string;
  userId: string;
  tokenHash: string;
  expiresAt: Date;
  attempts: number;
  consumedAt: Date | null;
};

export type ResetRecord = {
  id: string;
  userId: string;
  tokenHash: string;
  expiresAt: Date;
  consumedAt: Date | null;
};

export type AuthRepository = {
  findUserByEmail(email: string): Promise<UserRecord | null>;
  findUserById(id: string): Promise<UserRecord | null>;
  createUser(user: UserRecord): Promise<void>;
  updatePassword(userId: string, passwordHash: string, now: Date): Promise<void>;
  createSession(session: SessionRecord): Promise<void>;
  findSessionByTokenHash(tokenHash: string): Promise<SessionRecord | null>;
  touchSession(sessionId: string, lastUsedAt: Date, idleExpiresAt: Date): Promise<void>;
  revokeSession(sessionId: string, at: Date): Promise<void>;
  revokeAllUserSessions(userId: string, at: Date): Promise<void>;
  revokeSessionsByTenant(tenantId: string, at: Date): Promise<void>;
  findTotp(userId: string): Promise<TotpRecord | null>;
  upsertTotp(record: TotpRecord, enabledAt: Date): Promise<void>;
  createChallenge(challenge: ChallengeRecord): Promise<void>;
  findChallengeByTokenHash(tokenHash: string): Promise<ChallengeRecord | null>;
  incrementChallengeAttempts(id: string): Promise<number>;
  consumeChallenge(id: string, at: Date): Promise<void>;
  createPasswordReset(record: ResetRecord): Promise<void>;
  findPasswordResetByTokenHash(tokenHash: string): Promise<ResetRecord | null>;
  consumePasswordReset(id: string, at: Date): Promise<void>;
  recordLoginAttempt(input: {
    id: string;
    email: string;
    ipAddress: string | null;
    success: boolean;
    createdAt: Date;
  }): Promise<void>;
  recordSecurityEvent(input: {
    id: string;
    userId: string | null;
    type: string;
    ipAddress: string | null;
    userAgent: string | null;
    metadata: string | null;
    createdAt: Date;
  }): Promise<void>;
};

export function toPublicUser(
  user: UserRecord,
  tenant?: {
    id: string;
    name: string;
    status: import('@crediplus/shared').TenantStatus;
  } | null,
): PublicUser {
  return {
    id: user.id,
    email: user.email,
    isSuperAdmin: user.isSuperAdmin,
    tenantId: tenant?.id ?? null,
    tenantName: tenant?.name ?? null,
    tenantStatus: tenant?.status ?? null,
  };
}
