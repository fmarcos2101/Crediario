import { HttpException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import { ConsoleEmailProvider } from '../email/email.provider';
import { MemoryAuthRepository } from '../auth/memory-auth.repository';
import { MemoryTenantRepository } from './memory-tenant.repository';
import { TenantService } from './tenant.service';

function createTenants() {
  const users = new MemoryAuthRepository();
  const tenants = new MemoryTenantRepository();
  const email = new ConsoleEmailProvider();
  const service = new TenantService(tenants, users, email, 'http://localhost:3000');
  return { service, users, tenants, email };
}

describe('TenantService', () => {
  it('cria empresa, convite e só libera login após activate', async () => {
    const { service, email, users } = createTenants();
    const created = await service.createCompany('Loja A', 'dono@loja-a.test');
    const token = email.sent[0]?.text.match(/token=([^&\s]+)/)?.[1];
    expect(token).toBeTruthy();
    await service.acceptInvite(decodeURIComponent(token!), 'senha-loja-a1');
    const user = await users.findUserByEmail('dono@loja-a.test');
    expect(user).toBeTruthy();
    await expect(service.requireActiveMembership(user!.id)).rejects.toBeInstanceOf(
      HttpException,
    );
    await service.setCompanyStatus(created.tenantId, 'active');
    const membership = await service.requireActiveMembership(user!.id);
    expect(membership.tenantName).toBe('Loja A');
    expect(membership.tenantStatus).toBe('active');
  });

  it('settings de outro tenant id não vazam no guard de igualdade', async () => {
    const { service } = createTenants();
    const a = await service.createCompany('A', 'a@t.test');
    const b = await service.createCompany('B', 'b@t.test');
    const settingsA = await service.getSettingsForTenant(a.tenantId);
    expect(settingsA.tenantId).toBe(a.tenantId);
    expect(a.tenantId).not.toBe(b.tenantId);
  });
});
