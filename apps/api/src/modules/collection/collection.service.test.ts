import { HttpException } from '@nestjs/common';
import {
  DEFAULT_MSG_DUE_REMINDER,
  DEFAULT_MSG_OVERDUE,
  DEFAULT_MSG_PAYMENT_RECEIVED,
  DEFAULT_MSG_PROTEST_WARNING,
} from '@crediplus/shared';
import { describe, expect, it } from 'vitest';
import { encryptString, hmacSha256HexSecret } from '../../common/crypto';
import { ConsoleEmailProvider } from '../email/email.provider';
import { MemoryCustomerRepository } from '../customers/memory-customer.repository';
import { MemorySaleRepository } from '../sales/memory-sale.repository';
import { SaleService } from '../sales/sale.service';
import { MemoryTenantRepository } from '../tenants/memory-tenant.repository';
import type { TenantSettingsRecord } from '../tenants/tenant.types';
import { MemoryCollectionRepository } from './memory-collection.repository';
import { CollectionService } from './collection.service';

const TENANT_A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const TENANT_B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const CUSTOMER_A = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const CUSTOMER_B = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
const KEY = Buffer.alloc(32, 3).toString('base64');

function defaultSettings(tenantId: string): TenantSettingsRecord {
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
    reminderDaysBeforeDue: 3,
    overdueNudgeDays: 1,
    protestWarningDays: 15,
    collectionResponseHours: 24,
    msgDueReminderEnabled: true,
    msgDueReminderBody: DEFAULT_MSG_DUE_REMINDER,
    msgOverdueEnabled: true,
    msgOverdueBody: DEFAULT_MSG_OVERDUE,
    msgProtestWarningEnabled: true,
    msgProtestWarningBody: DEFAULT_MSG_PROTEST_WARNING,
    msgPaymentReceivedEnabled: true,
    msgPaymentReceivedBody: DEFAULT_MSG_PAYMENT_RECEIVED,
    paymentProvider: 'none',
    paymentConfigured: false,
    metaPhoneNumberId: null,
    metaWabaId: null,
    metaConfigured: false,
  };
}

function createStack(now = new Date('2026-03-01T12:00:00.000Z')) {
  const customers = new MemoryCustomerRepository();
  const tenants = new MemoryTenantRepository();
  const sales = new MemorySaleRepository();
  const collections = new MemoryCollectionRepository();
  const email = new ConsoleEmailProvider();
  const collection = new CollectionService(
    collections,
    sales,
    customers,
    tenants,
    email,
    KEY,
    () => now,
  );
  const service = new SaleService(sales, customers, tenants, () => now, collection);
  return { customers, tenants, sales, collections, email, collection, service, now };
}

async function seedTenant(
  tenants: MemoryTenantRepository,
  tenantId: string,
  name: string,
  now: Date,
) {
  await tenants.createTenant({
    id: tenantId,
    name,
    status: 'active',
    customerCount: 0,
    saleCount: 0,
    createdAt: now,
    updatedAt: now,
  });
  await tenants.createSettings(defaultSettings(tenantId));
}

async function seedCustomer(
  customers: MemoryCustomerRepository,
  tenantId: string,
  id: string,
  email: string | null,
) {
  await customers.create({
    id,
    tenantId,
    name: 'Maria Silva',
    phone: null,
    email,
    cpfHmac: `hmac-${id}`,
    cpfCiphertext: 'cipher',
    notes: null,
    status: 'active',
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
  });
}

describe('CollectionService', () => {
  it('envia lembrete uma vez e isola Tenant B', async () => {
    const { customers, tenants, collection, service, email, now } = createStack();
    await seedTenant(tenants, TENANT_A, 'Loja A', now);
    await seedTenant(tenants, TENANT_B, 'Loja B', now);
    await seedCustomer(customers, TENANT_A, CUSTOMER_A, 'maria@loja.test');
    await seedCustomer(customers, TENANT_B, CUSTOMER_B, 'outra@loja.test');
    const saleA = await service.create(TENANT_A, {
      customerId: CUSTOMER_A,
      items: [{ description: 'Geladeira', quantity: 1, unitPrice: '90.00' }],
      installmentCount: 1,
      frequency: 'monthly',
      firstDueDate: '2026-03-03',
    });
    await service.create(TENANT_B, {
      customerId: CUSTOMER_B,
      items: [{ description: 'Fogão', quantity: 1, unitPrice: '80.00' }],
      installmentCount: 1,
      frequency: 'monthly',
      firstDueDate: '2026-03-03',
    });
    const first = await collection.runDue(now);
    expect(first.find((item) => item.tenantId === TENANT_A)?.created).toBe(1);
    const second = await collection.runDue(now);
    expect(second.find((item) => item.tenantId === TENANT_A)?.created).toBe(0);
    const messages = await collection.listMessages(TENANT_A);
    expect(messages).toHaveLength(1);
    expect(messages[0]?.kind).toBe('due_reminder');
    expect(messages[0]?.status).toBe('sent');
    expect(messages[0]?.saleId).toBe(saleA.id);
    expect(email.sent).toHaveLength(2);
    expect(await collection.listMessages(TENANT_B)).toHaveLength(1);
    expect(await collection.listMessages(TENANT_A, saleA.id)).toHaveLength(1);
  });

  it('marca sem canal quando o cliente não tem e-mail', async () => {
    const { customers, tenants, collection, service, email, now } = createStack();
    await seedTenant(tenants, TENANT_A, 'Loja A', now);
    await seedCustomer(customers, TENANT_A, CUSTOMER_A, null);
    await service.create(TENANT_A, {
      customerId: CUSTOMER_A,
      items: [{ description: 'Microondas', quantity: 1, unitPrice: '50.00' }],
      installmentCount: 1,
      frequency: 'monthly',
      firstDueDate: '2026-03-03',
    });
    await collection.runTenant(TENANT_A, now);
    const messages = await collection.listMessages(TENANT_A);
    expect(messages[0]?.status).toBe('skipped_no_channel');
    expect(email.sent).toHaveLength(0);
  });

  it('aplica webhook com HMAC, rejeita assinatura e não duplica eventId', async () => {
    const { customers, tenants, collection, service, now } = createStack();
    await seedTenant(tenants, TENANT_A, 'Loja A', now);
    await seedCustomer(customers, TENANT_A, CUSTOMER_A, 'maria@loja.test');
    await tenants.upsertSecrets({
      tenantId: TENANT_A,
      paymentApiKeyCiphertext: null,
      paymentWebhookSecretCiphertext: encryptString('segredo-loja', KEY),
      metaAccessTokenCiphertext: null,
      metaAppSecretCiphertext: null,
    });
    const created = await service.create(TENANT_A, {
      customerId: CUSTOMER_A,
      items: [{ description: 'TV', quantity: 1, unitPrice: '40.00' }],
      installmentCount: 1,
      frequency: 'monthly',
      firstDueDate: '2026-04-01',
    });
    const installmentId = created.installments[0]!.id;
    const rawBody = JSON.stringify({
      eventId: 'evt-1',
      installmentId,
      amount: '10.00',
      method: 'PIX',
    });
    await expect(
      collection.handlePaymentWebhook({
        tenantId: TENANT_A,
        rawBody,
        signature: hmacSha256HexSecret(rawBody, 'errado'),
        ip: '10.0.0.1',
      }),
    ).rejects.toMatchObject({ status: 401 });
    const applied = await collection.handlePaymentWebhook({
      tenantId: TENANT_A,
      rawBody,
      signature: `sha256=${hmacSha256HexSecret(rawBody, 'segredo-loja')}`,
      ip: '10.0.0.1',
    });
    expect(applied.status).toBe('applied');
    const duplicate = await collection.handlePaymentWebhook({
      tenantId: TENANT_A,
      rawBody,
      signature: hmacSha256HexSecret(rawBody, 'segredo-loja'),
      ip: '10.0.0.1',
    });
    expect(duplicate.status).toBe('duplicate');
    const sale = await service.get(TENANT_A, created.id);
    expect(sale.installments[0]?.paidAmount).toBe('10.00');
    expect(sale.payments).toHaveLength(1);
    expect(sale.collectionMessages.some((item) => item.kind === 'payment_received')).toBe(
      true,
    );
    await expect(
      collection.handlePaymentWebhook({
        tenantId: TENANT_B,
        rawBody,
        signature: hmacSha256HexSecret(rawBody, 'segredo-loja'),
        ip: '10.0.0.1',
      }),
    ).rejects.toBeInstanceOf(HttpException);
  });
});
