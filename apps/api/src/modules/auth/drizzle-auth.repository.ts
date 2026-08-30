import {
  loginAttempts,
  loginChallenges,
  passwordResetTokens,
  securityEvents,
  sessions,
  userTotp,
  users,
} from '@crediplus/db';
import { and, eq, isNull } from 'drizzle-orm';
import type { Database } from '@crediplus/db';
import type {
  AuthRepository,
  ChallengeRecord,
  ResetRecord,
  SessionRecord,
  TotpRecord,
  UserRecord,
} from './auth.types';

export class DrizzleAuthRepository implements AuthRepository {
  constructor(private readonly db: Database) {}

  async findUserByEmail(email: string): Promise<UserRecord | null> {
    const rows = await this.db
      .select()
      .from(users)
      .where(eq(users.email, email))
      .limit(1);
    return rows[0] ? this.mapUser(rows[0]) : null;
  }

  async findUserById(id: string): Promise<UserRecord | null> {
    const rows = await this.db.select().from(users).where(eq(users.id, id)).limit(1);
    return rows[0] ? this.mapUser(rows[0]) : null;
  }

  async createUser(user: UserRecord): Promise<void> {
    await this.db.insert(users).values({
      id: user.id,
      email: user.email,
      passwordHash: user.passwordHash,
      isSuperAdmin: user.isSuperAdmin,
      status: user.status,
      emailVerifiedAt: user.emailVerifiedAt,
    });
  }

  async updatePassword(userId: string, passwordHash: string, now: Date): Promise<void> {
    await this.db
      .update(users)
      .set({ passwordHash, updatedAt: now })
      .where(eq(users.id, userId));
  }

  async createSession(session: SessionRecord): Promise<void> {
    await this.db.insert(sessions).values(session);
  }

  async findSessionByTokenHash(tokenHash: string): Promise<SessionRecord | null> {
    const rows = await this.db
      .select()
      .from(sessions)
      .where(eq(sessions.tokenHash, tokenHash))
      .limit(1);
    return rows[0] ? this.mapSession(rows[0]) : null;
  }

  async touchSession(
    sessionId: string,
    lastUsedAt: Date,
    idleExpiresAt: Date,
  ): Promise<void> {
    await this.db
      .update(sessions)
      .set({ lastUsedAt, idleExpiresAt })
      .where(eq(sessions.id, sessionId));
  }

  async revokeSession(sessionId: string, at: Date): Promise<void> {
    await this.db
      .update(sessions)
      .set({ revokedAt: at })
      .where(eq(sessions.id, sessionId));
  }

  async revokeAllUserSessions(userId: string, at: Date): Promise<void> {
    await this.db
      .update(sessions)
      .set({ revokedAt: at })
      .where(and(eq(sessions.userId, userId), isNull(sessions.revokedAt)));
  }

  async findTotp(userId: string): Promise<TotpRecord | null> {
    const rows = await this.db
      .select()
      .from(userTotp)
      .where(eq(userTotp.userId, userId))
      .limit(1);
    const row = rows[0];
    return row ? { userId: row.userId, secretCiphertext: row.secretCiphertext } : null;
  }

  async upsertTotp(record: TotpRecord, enabledAt: Date): Promise<void> {
    await this.db
      .insert(userTotp)
      .values({
        userId: record.userId,
        secretCiphertext: record.secretCiphertext,
        enabledAt,
      })
      .onConflictDoUpdate({
        target: userTotp.userId,
        set: { secretCiphertext: record.secretCiphertext, enabledAt },
      });
  }

  async createChallenge(challenge: ChallengeRecord): Promise<void> {
    await this.db.insert(loginChallenges).values(challenge);
  }

  async findChallengeByTokenHash(tokenHash: string): Promise<ChallengeRecord | null> {
    const rows = await this.db
      .select()
      .from(loginChallenges)
      .where(eq(loginChallenges.tokenHash, tokenHash))
      .limit(1);
    return rows[0] ? this.mapChallenge(rows[0]) : null;
  }

  async incrementChallengeAttempts(id: string): Promise<number> {
    const rows = await this.db
      .select()
      .from(loginChallenges)
      .where(eq(loginChallenges.id, id))
      .limit(1);
    const current = rows[0];
    if (!current) {
      return 0;
    }
    const attempts = current.attempts + 1;
    await this.db
      .update(loginChallenges)
      .set({ attempts })
      .where(eq(loginChallenges.id, id));
    return attempts;
  }

  async consumeChallenge(id: string, at: Date): Promise<void> {
    await this.db
      .update(loginChallenges)
      .set({ consumedAt: at })
      .where(eq(loginChallenges.id, id));
  }

  async createPasswordReset(record: ResetRecord): Promise<void> {
    await this.db.insert(passwordResetTokens).values(record);
  }

  async findPasswordResetByTokenHash(tokenHash: string): Promise<ResetRecord | null> {
    const rows = await this.db
      .select()
      .from(passwordResetTokens)
      .where(eq(passwordResetTokens.tokenHash, tokenHash))
      .limit(1);
    return rows[0] ? this.mapReset(rows[0]) : null;
  }

  async consumePasswordReset(id: string, at: Date): Promise<void> {
    await this.db
      .update(passwordResetTokens)
      .set({ consumedAt: at })
      .where(eq(passwordResetTokens.id, id));
  }

  async recordLoginAttempt(input: {
    id: string;
    email: string;
    ipAddress: string | null;
    success: boolean;
    createdAt: Date;
  }): Promise<void> {
    await this.db.insert(loginAttempts).values(input);
  }

  async recordSecurityEvent(input: {
    id: string;
    userId: string | null;
    type: string;
    ipAddress: string | null;
    userAgent: string | null;
    metadata: string | null;
    createdAt: Date;
  }): Promise<void> {
    await this.db.insert(securityEvents).values(input);
  }

  private mapUser(row: typeof users.$inferSelect): UserRecord {
    return {
      id: row.id,
      email: row.email,
      passwordHash: row.passwordHash,
      isSuperAdmin: row.isSuperAdmin,
      status: row.status,
      emailVerifiedAt: row.emailVerifiedAt,
    };
  }

  private mapSession(row: typeof sessions.$inferSelect): SessionRecord {
    return { ...row };
  }

  private mapChallenge(row: typeof loginChallenges.$inferSelect): ChallengeRecord {
    return { ...row };
  }

  private mapReset(row: typeof passwordResetTokens.$inferSelect): ResetRecord {
    return { ...row };
  }
}
