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

  it('grava chave de pagamento cifrada e só expõe o flag', async () => {
    const users = new MemoryAuthRepository();
    const tenants = new MemoryTenantRepository();
    const email = new ConsoleEmailProvider();
    const key = Buffer.alloc(32, 5).toString('base64');
    const service = new TenantService(
      tenants,
      users,
      email,
      'http://localhost:3000',
      key,
    );
    const created = await service.createCompany('Loja A', 'dono@loja-a.test');
    const updated = await service.updateSettingsForTenant(created.tenantId, {
      paymentProvider: 'asaas',
      paymentApiKey: 'sk_test_nao_vazar',
      protestWarningDays: 10,
    });
    expect(updated.paymentConfigured).toBe(true);
    expect(updated.protestWarningDays).toBe(10);
    expect(JSON.stringify(updated)).not.toContain('sk_test_nao_vazar');
    const stored = await tenants.findSecrets(created.tenantId);
    expect(stored?.paymentApiKeyCiphertext).toBeTruthy();
    expect(stored?.paymentApiKeyCiphertext).not.toContain('sk_test');

    const withMeta = await service.updateSettingsForTenant(created.tenantId, {
      metaAccessToken: 'EAAG-token-secreto',
      msgProtestWarningBody: 'Aviso de protesto para {nome} em {data}.',
    });
    expect(withMeta.metaConfigured).toBe(true);
    expect(withMeta.msgProtestWarningBody).toContain('{nome}');
    expect(JSON.stringify(withMeta)).not.toContain('EAAG-token-secreto');

    const listed = await service.listCompanies();
    expect(listed[0]?.paymentConfigured).toBe(true);
    expect(listed[0]?.metaConfigured).toBe(true);
    expect(JSON.stringify(listed)).not.toContain('sk_test');
    expect(JSON.stringify(listed)).not.toContain('EAAG');
  });
});
