import type {
  AuthRepository,
  ChallengeRecord,
  ResetRecord,
  SessionRecord,
  TotpRecord,
  UserRecord,
} from './auth.types';

export class MemoryAuthRepository implements AuthRepository {
  users: UserRecord[] = [];
  sessions: SessionRecord[] = [];
  totp: TotpRecord[] = [];
  challenges: ChallengeRecord[] = [];
  resets: ResetRecord[] = [];

  async findUserByEmail(email: string): Promise<UserRecord | null> {
    return this.users.find((user) => user.email === email) ?? null;
  }

  async findUserById(id: string): Promise<UserRecord | null> {
    return this.users.find((user) => user.id === id) ?? null;
  }

  async createUser(user: UserRecord): Promise<void> {
    this.users.push({ ...user });
  }

  async updatePassword(userId: string, passwordHash: string, now: Date): Promise<void> {
    const user = this.users.find((item) => item.id === userId);
    if (user) {
      user.passwordHash = passwordHash;
    }
    void now;
  }

  async createSession(session: SessionRecord): Promise<void> {
    this.sessions.push({ ...session });
  }

  async findSessionByTokenHash(tokenHash: string): Promise<SessionRecord | null> {
    return this.sessions.find((session) => session.tokenHash === tokenHash) ?? null;
  }

  async touchSession(
    sessionId: string,
    lastUsedAt: Date,
    idleExpiresAt: Date,
  ): Promise<void> {
    const session = this.sessions.find((item) => item.id === sessionId);
    if (session) {
      session.lastUsedAt = lastUsedAt;
      session.idleExpiresAt = idleExpiresAt;
    }
  }

  async revokeSession(sessionId: string, at: Date): Promise<void> {
    const session = this.sessions.find((item) => item.id === sessionId);
    if (session) {
      session.revokedAt = at;
    }
  }

  async revokeAllUserSessions(userId: string, at: Date): Promise<void> {
    for (const session of this.sessions) {
      if (session.userId === userId && !session.revokedAt) {
        session.revokedAt = at;
      }
    }
  }

  async revokeSessionsByTenant(tenantId: string, at: Date): Promise<void> {
    for (const session of this.sessions) {
      if (session.tenantId === tenantId && !session.revokedAt) {
        session.revokedAt = at;
      }
    }
  }

  async findLastAccessByTenant(tenantId: string): Promise<Date | null> {
    const matches = this.sessions.filter((session) => session.tenantId === tenantId);
    if (matches.length === 0) {
      return null;
    }
    return matches.reduce(
      (latest, session) => (session.lastUsedAt > latest ? session.lastUsedAt : latest),
      matches[0]!.lastUsedAt,
    );
  }

  async findTotp(userId: string): Promise<TotpRecord | null> {
    return this.totp.find((item) => item.userId === userId) ?? null;
  }

  async upsertTotp(record: TotpRecord, _enabledAt: Date): Promise<void> {
    this.totp = this.totp.filter((item) => item.userId !== record.userId);
    this.totp.push({ ...record });
  }

  async createChallenge(challenge: ChallengeRecord): Promise<void> {
    this.challenges.push({ ...challenge });
  }

  async findChallengeByTokenHash(tokenHash: string): Promise<ChallengeRecord | null> {
    return this.challenges.find((item) => item.tokenHash === tokenHash) ?? null;
  }

  async incrementChallengeAttempts(id: string): Promise<number> {
    const challenge = this.challenges.find((item) => item.id === id);
    if (!challenge) {
      return 0;
    }
    challenge.attempts += 1;
    return challenge.attempts;
  }

  async consumeChallenge(id: string, at: Date): Promise<void> {
    const challenge = this.challenges.find((item) => item.id === id);
    if (challenge) {
      challenge.consumedAt = at;
    }
  }

  async createPasswordReset(record: ResetRecord): Promise<void> {
    this.resets.push({ ...record });
  }

  async findPasswordResetByTokenHash(tokenHash: string): Promise<ResetRecord | null> {
    return this.resets.find((item) => item.tokenHash === tokenHash) ?? null;
  }

  async consumePasswordReset(id: string, at: Date): Promise<boolean> {
    const record = this.resets.find((item) => item.id === id);
    if (!record || record.consumedAt || record.expiresAt <= at) {
      return false;
    }
    record.consumedAt = at;
    return true;
  }

  async recordLoginAttempt(): Promise<void> {}

  async recordSecurityEvent(): Promise<void> {}
}
