import { HttpException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import { CustomerService } from './customer.service';
import { MemoryCustomerRepository } from './memory-customer.repository';

const KEY = Buffer.alloc(32, 7).toString('base64');
const TENANT_A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const TENANT_B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

function createService() {
  const repo = new MemoryCustomerRepository();
  const service = new CustomerService(repo, KEY);
  return { repo, service };
}

describe('CustomerService', () => {
  it('cria cliente, mascara CPF na lista e devolve CPF só no detalhe', async () => {
    const { service } = createService();
    const created = await service.create(TENANT_A, {
      name: 'Maria Silva',
      cpf: '529.982.247-25',
      phone: '11999999999',
    });
    expect(created.cpf).toBe('529.982.247-25');
    expect(created.cpfMasked).toBe('***.***.***-25');
    const listed = await service.list(TENANT_A, {});
    expect(listed[0]?.cpf).toBeNull();
    expect(listed[0]?.cpfMasked).toBe('***.***.***-25');
    const detailed = await service.get(TENANT_A, created.id);
    expect(detailed.cpf).toBe('529.982.247-25');
  });

  it('não deixa Tenant B ler cliente de Tenant A', async () => {
    const { service } = createService();
    const created = await service.create(TENANT_A, {
      name: 'Maria Silva',
      cpf: '529.982.247-25',
    });
    await expect(service.get(TENANT_B, created.id)).rejects.toBeInstanceOf(HttpException);
    try {
      await service.get(TENANT_B, created.id);
    } catch (error) {
      expect((error as HttpException).getStatus()).toBe(404);
    }
    const listed = await service.list(TENANT_B, {});
    expect(listed).toEqual([]);
  });

  it('rejeita CPF duplicado no mesmo tenant', async () => {
    const { service } = createService();
    await service.create(TENANT_A, { name: 'A', cpf: '52998224725' });
    await expect(
      service.create(TENANT_A, { name: 'B', cpf: '529.982.247-25' }),
    ).rejects.toMatchObject({ status: 409 });
  });

  it('busca por CPF via HMAC', async () => {
    const { service } = createService();
    await service.create(TENANT_A, { name: 'Maria Silva', cpf: '52998224725' });
    const found = await service.list(TENANT_A, { q: '529.982.247-25' });
    expect(found).toHaveLength(1);
    expect(found[0]?.name).toBe('Maria Silva');
  });

  it('arquiva sem apagar', async () => {
    const { service, repo } = createService();
    const created = await service.create(TENANT_A, {
      name: 'Maria Silva',
      cpf: '52998224725',
    });
    await service.archive(TENANT_A, created.id);
    const row = await repo.findById(TENANT_A, created.id);
    expect(row?.status).toBe('archived');
  });

  it('reativa cliente arquivado com o mesmo CPF', async () => {
    const { service } = createService();
    const created = await service.create(TENANT_A, {
      name: 'Maria Silva',
      cpf: '52998224725',
    });
    await service.archive(TENANT_A, created.id);
    const again = await service.create(TENANT_A, {
      name: 'Maria Atualizada',
      cpf: '529.982.247-25',
    });
    expect(again.id).toBe(created.id);
    expect(again.status).toBe('active');
    expect(again.name).toBe('Maria Atualizada');
  });
});
