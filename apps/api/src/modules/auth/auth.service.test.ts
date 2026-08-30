import { HttpException } from '@nestjs/common';
import { Secret, TOTP } from 'otpauth';
import { describe, expect, it } from 'vitest';
import { decryptString } from '../../common/crypto';
import { ConsoleEmailProvider } from '../email/email.provider';
import { MemoryTenantRepository } from '../tenants/memory-tenant.repository';
import { TenantService } from '../tenants/tenant.service';
import { AuthService } from './auth.service';
import { MemoryAuthRepository } from './memory-auth.repository';

const ENCRYPTION_KEY = Buffer.alloc(32, 9).toString('base64');

function createAuth(repo = new MemoryAuthRepository()) {
  const email = new ConsoleEmailProvider();
  const auth = new AuthService(
    repo,
    {
      APP_ORIGIN: 'http://localhost:3000',
      APP_ENCRYPTION_KEY: ENCRYPTION_KEY,
      SESSION_TTL_HOURS: 12,
      SUPERADMIN_SESSION_TTL_HOURS: 4,
      SUPERADMIN_IDLE_MINUTES: 30,
    },
    email,
  );
  return { auth, repo, email };
}

const ctx = { ip: '127.0.0.1', userAgent: 'vitest' };

describe('AuthService', () => {
  it('rejeita senha errada com mensagem genérica', async () => {
    const { auth } = createAuth();
    await auth.bootstrapSuperAdmin('admin@crediplus.local', 'super-senha-12');
    await expect(
      auth.login('admin@crediplus.local', 'senha-errada-12', ctx),
    ).rejects.toMatchObject({
      message: 'Credenciais inválidas.',
      status: 401,
    });
  });

  it('não revela se o e-mail existe', async () => {
    const { auth } = createAuth();
    await expect(
      auth.login('ninguem@crediplus.local', 'qualquer-senha-12', ctx),
    ).rejects.toBeInstanceOf(HttpException);
  });

  it('exige TOTP no Super Admin e emite sessão após código válido', async () => {
    const { auth, repo } = createAuth();
    const boot = await auth.bootstrapSuperAdmin(
      'admin@crediplus.local',
      'super-senha-12',
    );
    const first = await auth.login('admin@crediplus.local', 'super-senha-12', ctx);
    expect(first.kind).toBe('totp');
    if (first.kind !== 'totp') {
      return;
    }

    const totpRow = repo.totp[0];
    expect(totpRow).toBeDefined();
    const secret = decryptString(totpRow!.secretCiphertext, ENCRYPTION_KEY);
    const totp = new TOTP({
      issuer: 'CrediPlus',
      label: 'admin@crediplus.local',
      algorithm: 'SHA1',
      digits: 6,
      period: 30,
      secret: Secret.fromBase32(secret),
    });
    const session = await auth.verifyTotp(first.challengeToken, totp.generate(), ctx);
    expect(session.kind).toBe('session');
    expect(session.user.email).toBe('admin@crediplus.local');
    expect(session.user.isSuperAdmin).toBe(true);

    const resolved = await auth.resolveSession(session.sessionToken);
    expect(resolved?.user.email).toBe('admin@crediplus.local');
    expect(boot.otpauthUrl).toContain('otpauth://totp/');
  });

  it('rejeita challenge TOTP reutilizado', async () => {
    const { auth, repo } = createAuth();
    await auth.bootstrapSuperAdmin('admin@crediplus.local', 'super-senha-12');
    const first = await auth.login('admin@crediplus.local', 'super-senha-12', ctx);
    if (first.kind !== 'totp') {
      throw new Error('esperado totp');
    }
    const secret = decryptString(repo.totp[0]!.secretCiphertext, ENCRYPTION_KEY);
    const totp = new TOTP({
      issuer: 'CrediPlus',
      label: 'admin@crediplus.local',
      algorithm: 'SHA1',
      digits: 6,
      period: 30,
      secret: Secret.fromBase32(secret),
    });
    const code = totp.generate();
    await auth.verifyTotp(first.challengeToken, code, ctx);
    await expect(auth.verifyTotp(first.challengeToken, code, ctx)).rejects.toMatchObject({
      status: 401,
    });
  });

  it('reset de senha é de uso único e revoga sessões', async () => {
    const { auth, email } = createAuth();
    await auth.bootstrapSuperAdmin('admin@crediplus.local', 'super-senha-12');
    await auth.forgotPassword('admin@crediplus.local', ctx);
    const match = email.sent[0]?.text.match(/token=([^&\s]+)/);
    expect(match?.[1]).toBeTruthy();
    const token = decodeURIComponent(match![1]!);
    await auth.resetPassword(token, 'nova-senha-1234', ctx);
    await expect(
      auth.resetPassword(token, 'outra-senha-1234', ctx),
    ).rejects.toMatchObject({
      status: 400,
    });
    await expect(
      auth.login('admin@crediplus.local', 'super-senha-12', ctx),
    ).rejects.toMatchObject({
      status: 401,
    });
  });

  it('só autentica usuário de empresa após liberação', async () => {
    const repo = new MemoryAuthRepository();
    const tenants = new MemoryTenantRepository();
    const email = new ConsoleEmailProvider();
    const tenantService = new TenantService(
      tenants,
      repo,
      email,
      'http://localhost:3000',
    );
    const auth = new AuthService(
      repo,
      {
        APP_ORIGIN: 'http://localhost:3000',
        APP_ENCRYPTION_KEY: ENCRYPTION_KEY,
        SESSION_TTL_HOURS: 12,
        SUPERADMIN_SESSION_TTL_HOURS: 4,
        SUPERADMIN_IDLE_MINUTES: 30,
      },
      email,
      tenantService,
    );

    const created = await tenantService.createCompany('Loja A', 'dono@loja-a.test');
    const token = email.sent[0]?.text.match(/token=([^&\s]+)/)?.[1];
    expect(token).toBeTruthy();
    await tenantService.acceptInvite(decodeURIComponent(token!), 'senha-loja-a12');

    await expect(
      auth.login('dono@loja-a.test', 'senha-loja-a12', ctx),
    ).rejects.toMatchObject({ status: 403 });

    await tenantService.setCompanyStatus(created.tenantId, 'active');
    const session = await auth.login('dono@loja-a.test', 'senha-loja-a12', ctx);
    expect(session.kind).toBe('session');
    if (session.kind !== 'session') {
      return;
    }
    expect(session.user.isSuperAdmin).toBe(false);
    expect(session.user.tenantName).toBe('Loja A');
    expect(session.user.tenantStatus).toBe('active');
  });

  it('aplica rate limit no login', async () => {
    const { auth } = createAuth();
    for (let i = 0; i < 5; i += 1) {
      await auth
        .login('x@crediplus.local', 'errada-senha-12', ctx)
        .catch(() => undefined);
    }
    await expect(
      auth.login('x@crediplus.local', 'errada-senha-12', ctx),
    ).rejects.toMatchObject({
      status: 429,
    });
  });
});
