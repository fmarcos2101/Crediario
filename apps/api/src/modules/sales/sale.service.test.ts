import { HttpException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import { MemoryCustomerRepository } from '../customers/memory-customer.repository';
import { MemoryTenantRepository } from '../tenants/memory-tenant.repository';
import { MemorySaleRepository } from './memory-sale.repository';
import { SaleService } from './sale.service';

const TENANT_A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const TENANT_B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const CUSTOMER_A = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';

function createService(now = new Date('2026-03-01T12:00:00.000Z')) {
  const customers = new MemoryCustomerRepository();
  const tenants = new MemoryTenantRepository();
  const sales = new MemorySaleRepository();
  const service = new SaleService(sales, customers, tenants, () => now);
  return { customers, tenants, sales, service };
}

async function seedCustomer(
  customers: MemoryCustomerRepository,
  tenantId = TENANT_A,
  id = CUSTOMER_A,
) {
  await customers.create({
    id,
    tenantId,
    name: 'Maria Silva',
    phone: null,
    email: null,
    cpfHmac: 'hmac',
    cpfCiphertext: 'cipher',
    notes: null,
    status: 'active',
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
  });
}

describe('SaleService', () => {
  it('cria venda, reparte centavos e não deixa Tenant B ler', async () => {
    const { service, customers } = createService();
    await seedCustomer(customers);
    const created = await service.create(TENANT_A, {
      customerId: CUSTOMER_A,
      items: [{ description: 'Geladeira', quantity: 1, unitPrice: '1000' }],
      downPayment: '0',
      installmentCount: 3,
      frequency: 'monthly',
      firstDueDate: '2026-01-31',
    });
    expect(created.totalAmount).toBe('1000.00');
    expect(created.installments.map((item) => item.amount)).toEqual([
      '333.33',
      '333.33',
      '333.34',
    ]);
    expect(created.installments.map((item) => item.dueDate)).toEqual([
      '2026-01-31',
      '2026-02-28',
      '2026-03-31',
    ]);
    await expect(service.get(TENANT_B, created.id)).rejects.toBeInstanceOf(HttpException);
    expect(await service.list(TENANT_B, {})).toEqual([]);
  });

  it('registra pagamento parcial e estorno', async () => {
    const { service, customers } = createService();
    await seedCustomer(customers);
    const created = await service.create(TENANT_A, {
      customerId: CUSTOMER_A,
      items: [{ description: 'Fogão', quantity: 1, unitPrice: '300.00' }],
      installmentCount: 1,
      frequency: 'monthly',
      firstDueDate: '2026-04-01',
    });
    const installmentId = created.installments[0]!.id;
    const paid = await service.recordPayment(TENANT_A, created.id, {
      installmentId,
      amount: '100.00',
      method: 'PIX',
    });
    expect(paid.installments[0]?.status).toBe('PARTIALLY_PAID');
    expect(paid.installments[0]?.remaining).toBe('200.00');
    const paymentId = paid.payments[0]!.id;
    const reversed = await service.reversePayment(TENANT_A, created.id, paymentId, {
      reason: 'Digitado errado',
    });
    expect(reversed.installments[0]?.status).toBe('OPEN');
    expect(reversed.installments[0]?.paidAmount).toBe('0.00');
    expect(reversed.payments[0]?.netAmount).toBe('0.00');
  });

  it('rejeita pagamento acima do saldo e cancelamento após baixa', async () => {
    const { service, customers } = createService();
    await seedCustomer(customers);
    const created = await service.create(TENANT_A, {
      customerId: CUSTOMER_A,
      items: [{ description: 'Microondas', quantity: 1, unitPrice: '50.00' }],
      installmentCount: 1,
      frequency: 'monthly',
      firstDueDate: '2026-04-01',
    });
    await expect(
      service.recordPayment(TENANT_A, created.id, {
        installmentId: created.installments[0]!.id,
        amount: '50.01',
        method: 'CASH',
      }),
    ).rejects.toMatchObject({ status: 400 });
    await service.recordPayment(TENANT_A, created.id, {
      installmentId: created.installments[0]!.id,
      amount: '50.00',
      method: 'CASH',
    });
    await expect(service.cancel(TENANT_A, created.id)).rejects.toMatchObject({
      status: 409,
    });
  });

  it('revalida o saldo na escrita e bloqueia segunda baixa concorrente', async () => {
    const { service, customers, sales } = createService();
    await seedCustomer(customers);
    const created = await service.create(TENANT_A, {
      customerId: CUSTOMER_A,
      items: [{ description: 'TV', quantity: 1, unitPrice: '50.00' }],
      installmentCount: 1,
      frequency: 'monthly',
      firstDueDate: '2026-04-01',
    });
    const installmentId = created.installments[0]!.id;
    const now = new Date('2026-03-01T12:00:00.000Z');
    const first = await sales.applyPayment({
      id: '11111111-1111-4111-8111-111111111111',
      tenantId: TENANT_A,
      saleId: created.id,
      installmentId,
      amount: '40.00',
      reversedAmount: '0.00',
      method: 'PIX',
      paidAt: now,
      notes: null,
      createdAt: now,
    });
    const second = await sales.applyPayment({
      id: '22222222-2222-4222-8222-222222222222',
      tenantId: TENANT_A,
      saleId: created.id,
      installmentId,
      amount: '40.00',
      reversedAmount: '0.00',
      method: 'CASH',
      paidAt: now,
      notes: null,
      createdAt: now,
    });
    expect(first).toBe('applied');
    expect(second).toBe('insufficient');
    const sale = await service.get(TENANT_A, created.id);
    expect(sale.installments[0]?.paidAmount).toBe('40.00');
    expect(sale.payments).toHaveLength(1);
  });
});
