import { HttpException, HttpStatus } from '@nestjs/common';
import {
  collectionEmailSubject,
  collectionOccurrenceKey,
  collectionTemplateDate,
  formatMoney,
  money,
  paymentWebhookSchema,
  planCollection,
  renderCollectionTemplate,
  todayIsoDate,
  type CollectionKind,
  type PaymentWebhookInput,
} from '@crediplus/shared';
import { v7 as uuidv7 } from 'uuid';
import { decryptString, hmacHexMatches, hmacSha256HexSecret } from '../../common/crypto';
import { MemoryRateLimiter } from '../../common/rate-limit';
import type { EmailProvider } from '../email/email.provider';
import { runWithRls } from '../tenants/rls-als';
import type {
  CustomerRecord,
  CustomerRepository,
  TenantRepository,
  TenantSettingsRecord,
} from '../tenants/tenant.types';
import type { InstallmentRecord, SaleRepository } from '../sales/sale.types';
import type {
  CollectionMessageRecord,
  CollectionRepository,
  PaymentWebhookEventRecord,
} from './collection.types';

const NOT_FOUND = 'Recurso não encontrado.';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type PublicCollectionMessage = {
  id: string;
  saleId: string;
  installmentId: string;
  paymentId: string | null;
  kind: CollectionKind;
  channel: CollectionMessageRecord['channel'];
  status: CollectionMessageRecord['status'];
  recipient: string | null;
  body: string;
  createdAt: Date;
};

export type CollectionRunResult = {
  tenantId: string;
  created: number;
};

export type PaymentWebhookResult = {
  status: PaymentWebhookEventRecord['status'];
};

export class CollectionService {
  constructor(
    private readonly collections: CollectionRepository,
    private readonly sales: SaleRepository,
    private readonly customers: CustomerRepository,
    private readonly tenants: TenantRepository,
    private readonly email: EmailProvider,
    private readonly encryptionKey: string | undefined,
    private readonly now: () => Date = () => new Date(),
    private readonly webhookLimiter = new MemoryRateLimiter(60 * 1000, 60),
  ) {}

  async listMessages(
    tenantId: string,
    saleId?: string,
  ): Promise<PublicCollectionMessage[]> {
    return runWithRls({ tenantId, isSuperAdmin: false }, async () => {
      const rows = await this.collections.listMessages(tenantId, saleId);
      return rows.map((row) => this.toPublic(row));
    });
  }

  async runDue(now = this.now()): Promise<CollectionRunResult[]> {
    const tenants = await runWithRls({ tenantId: null, isSuperAdmin: true }, () =>
      this.tenants.listTenants(),
    );
    const results: CollectionRunResult[] = [];
    for (const tenant of tenants) {
      if (tenant.status !== 'active') {
        continue;
      }
      results.push(await this.runTenant(tenant.id, now));
    }
    return results;
  }

  async runTenant(tenantId: string, now = this.now()): Promise<CollectionRunResult> {
    return runWithRls({ tenantId, isSuperAdmin: false }, async () => {
      const settings = await this.tenants.findSettings(tenantId);
      if (!settings) {
        return { tenantId, created: 0 };
      }
      const sales = await this.sales.listSales(tenantId, { status: 'open' });
      const installments = await this.sales.listInstallmentsForSales(
        tenantId,
        sales.map((row) => row.id),
      );
      const bySale = new Map<string, InstallmentRecord[]>();
      for (const installment of installments) {
        const current = bySale.get(installment.saleId) ?? [];
        current.push(installment);
        bySale.set(installment.saleId, current);
      }
      const today = todayIsoDate(now);
      let created = 0;
      for (const sale of sales) {
        const customer = await this.customers.findById(tenantId, sale.customerId);
        if (!customer) {
          continue;
        }
        const existing = await this.collections.listMessages(tenantId, sale.id);
        for (const installment of bySale.get(sale.id) ?? []) {
          const remaining = money(installment.amount).minus(installment.paidAmount);
          const sentKinds = existing
            .filter((item) => item.installmentId === installment.id)
            .map((item) => item.kind);
          const planned = planCollection({
            remainingPositive: remaining.gt(0),
            cancelled: installment.status === 'CANCELLED',
            dueDate: installment.dueDate,
            today,
            reminderDaysBeforeDue: settings.reminderDaysBeforeDue,
            overdueNudgeDays: settings.overdueNudgeDays,
            protestWarningDays: settings.protestWarningDays,
            sentKinds,
          });
          for (const kind of planned) {
            const result = await this.deliver({
              tenantId,
              saleId: sale.id,
              installment,
              customer,
              settings,
              kind,
              extra: installment.dueDate,
              paymentId: null,
              amount: formatMoney(remaining),
              at: now,
            });
            if (result === 'inserted') {
              created += 1;
            }
          }
        }
      }
      return { tenantId, created };
    });
  }

  async notifyPaymentReceived(input: {
    tenantId: string;
    saleId: string;
    installmentId: string;
    paymentId: string;
    amount: string;
  }): Promise<void> {
    await runWithRls({ tenantId: input.tenantId, isSuperAdmin: false }, async () => {
      const sale = await this.sales.findSale(input.tenantId, input.saleId);
      const installment = await this.sales.findInstallment(
        input.tenantId,
        input.installmentId,
      );
      if (!sale || !installment) {
        return;
      }
      const customer = await this.customers.findById(input.tenantId, sale.customerId);
      const settings = await this.tenants.findSettings(input.tenantId);
      if (!customer || !settings) {
        return;
      }
      await this.deliver({
        tenantId: input.tenantId,
        saleId: input.saleId,
        installment,
        customer,
        settings,
        kind: 'payment_received',
        extra: input.paymentId,
        paymentId: input.paymentId,
        amount: input.amount,
        at: this.now(),
      });
    });
  }

  async handlePaymentWebhook(input: {
    tenantId: string;
    rawBody: string;
    signature: string | undefined;
    ip: string;
  }): Promise<PaymentWebhookResult> {
    if (!UUID.test(input.tenantId)) {
      throw new HttpException(NOT_FOUND, HttpStatus.NOT_FOUND);
    }
    if (!this.webhookLimiter.consume(`${input.ip}:${input.tenantId}`)) {
      throw new HttpException(
        'Muitas tentativas. Tente novamente em instantes.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    return runWithRls({ tenantId: input.tenantId, isSuperAdmin: false }, async () => {
      const tenant = await this.tenants.findTenantById(input.tenantId);
      const secrets = await this.tenants.findSecrets(input.tenantId);
      const key = this.encryptionKey;
      if (!tenant || !secrets?.paymentWebhookSecretCiphertext || !key) {
        throw new HttpException(NOT_FOUND, HttpStatus.NOT_FOUND);
      }
      let secret: string;
      try {
        secret = decryptString(secrets.paymentWebhookSecretCiphertext, key);
      } catch {
        throw new HttpException(NOT_FOUND, HttpStatus.NOT_FOUND);
      }
      const expected = hmacSha256HexSecret(input.rawBody, secret);
      if (!hmacHexMatches(expected, input.signature ?? '')) {
        throw new HttpException('Assinatura inválida.', HttpStatus.UNAUTHORIZED);
      }
      let parsedJson: unknown;
      try {
        parsedJson = JSON.parse(input.rawBody) as unknown;
      } catch {
        throw new HttpException('Dados inválidos.', HttpStatus.BAD_REQUEST);
      }
      const parsed = paymentWebhookSchema.safeParse(parsedJson);
      if (!parsed.success) {
        throw new HttpException('Dados inválidos.', HttpStatus.BAD_REQUEST);
      }
      const body = parsed.data;
      const claimed = await this.collections.insertWebhookEvent({
        id: uuidv7(),
        tenantId: input.tenantId,
        eventId: body.eventId,
        installmentId: body.installmentId,
        paymentId: null,
        status: 'ignored',
        payload: input.rawBody,
        createdAt: this.now(),
      });
      if (claimed === 'duplicate') {
        return { status: 'duplicate' };
      }
      return this.applyWebhookPayment(input.tenantId, body);
    });
  }

  private async applyWebhookPayment(
    tenantId: string,
    body: PaymentWebhookInput,
  ): Promise<PaymentWebhookResult> {
    const installment = await this.sales.findInstallment(tenantId, body.installmentId);
    if (!installment) {
      await this.collections.updateWebhookEvent(tenantId, body.eventId, {
        status: 'ignored',
        installmentId: body.installmentId,
      });
      return { status: 'ignored' };
    }
    const now = this.now();
    const paymentId = uuidv7();
    const result = await this.sales.applyPayment({
      id: paymentId,
      tenantId,
      saleId: installment.saleId,
      installmentId: installment.id,
      amount: formatMoney(body.amount),
      reversedAmount: '0.00',
      method: body.method ?? 'OTHER',
      paidAt: body.paidAt ? new Date(body.paidAt) : now,
      notes: null,
      createdAt: now,
    });
    if (result !== 'applied') {
      await this.collections.updateWebhookEvent(tenantId, body.eventId, {
        status: 'failed',
        installmentId: installment.id,
      });
      return { status: 'failed' };
    }
    await this.collections.updateWebhookEvent(tenantId, body.eventId, {
      status: 'applied',
      installmentId: installment.id,
      paymentId,
    });
    await this.notifyPaymentReceived({
      tenantId,
      saleId: installment.saleId,
      installmentId: installment.id,
      paymentId,
      amount: formatMoney(body.amount),
    });
    return { status: 'applied' };
  }

  private async deliver(input: {
    tenantId: string;
    saleId: string;
    installment: InstallmentRecord;
    customer: CustomerRecord;
    settings: TenantSettingsRecord;
    kind: CollectionKind;
    extra: string;
    paymentId: string | null;
    amount: string;
    at: Date;
  }): Promise<'inserted' | 'duplicate'> {
    const config = this.kindConfig(input.settings, input.kind);
    const body = renderCollectionTemplate(config.body, {
      nome: input.customer.name,
      data: collectionTemplateDate(input.installment.dueDate),
      valor: this.brl(input.amount),
    });
    const occurrenceKey = collectionOccurrenceKey(
      input.kind,
      input.installment.id,
      input.extra,
    );
    if (!config.enabled) {
      return this.collections.insertMessage({
        id: uuidv7(),
        tenantId: input.tenantId,
        saleId: input.saleId,
        installmentId: input.installment.id,
        paymentId: input.paymentId,
        kind: input.kind,
        channel: 'none',
        status: 'skipped_disabled',
        occurrenceKey,
        recipient: null,
        body,
        createdAt: input.at,
      });
    }
    const email = input.customer.email?.trim() ?? '';
    if (!email) {
      return this.collections.insertMessage({
        id: uuidv7(),
        tenantId: input.tenantId,
        saleId: input.saleId,
        installmentId: input.installment.id,
        paymentId: input.paymentId,
        kind: input.kind,
        channel: 'none',
        status: 'skipped_no_channel',
        occurrenceKey,
        recipient: null,
        body,
        createdAt: input.at,
      });
    }
    await this.email.send({
      to: email,
      subject: collectionEmailSubject(input.kind),
      text: body,
    });
    return this.collections.insertMessage({
      id: uuidv7(),
      tenantId: input.tenantId,
      saleId: input.saleId,
      installmentId: input.installment.id,
      paymentId: input.paymentId,
      kind: input.kind,
      channel: 'email',
      status: 'sent',
      occurrenceKey,
      recipient: email,
      body,
      createdAt: input.at,
    });
  }

  private kindConfig(
    settings: TenantSettingsRecord,
    kind: CollectionKind,
  ): { enabled: boolean; body: string } {
    if (kind === 'due_reminder') {
      return {
        enabled: settings.msgDueReminderEnabled,
        body: settings.msgDueReminderBody,
      };
    }
    if (kind === 'overdue') {
      return { enabled: settings.msgOverdueEnabled, body: settings.msgOverdueBody };
    }
    if (kind === 'protest_warning') {
      return {
        enabled: settings.msgProtestWarningEnabled,
        body: settings.msgProtestWarningBody,
      };
    }
    return {
      enabled: settings.msgPaymentReceivedEnabled,
      body: settings.msgPaymentReceivedBody,
    };
  }

  private toPublic(row: CollectionMessageRecord): PublicCollectionMessage {
    return {
      id: row.id,
      saleId: row.saleId,
      installmentId: row.installmentId,
      paymentId: row.paymentId,
      kind: row.kind,
      channel: row.channel,
      status: row.status,
      recipient: row.recipient,
      body: row.body,
      createdAt: row.createdAt,
    };
  }

  private brl(value: string): string {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(Number(value));
  }
}
