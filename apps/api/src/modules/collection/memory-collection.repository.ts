import type {
  CollectionMessageRecord,
  CollectionRepository,
  PaymentWebhookEventRecord,
} from './collection.types';

export class MemoryCollectionRepository implements CollectionRepository {
  messages: CollectionMessageRecord[] = [];
  webhooks: PaymentWebhookEventRecord[] = [];

  async insertMessage(
    record: CollectionMessageRecord,
  ): Promise<'inserted' | 'duplicate'> {
    const exists = this.messages.some(
      (item) =>
        item.tenantId === record.tenantId && item.occurrenceKey === record.occurrenceKey,
    );
    if (exists) {
      return 'duplicate';
    }
    this.messages.push({ ...record });
    return 'inserted';
  }

  async listMessages(
    tenantId: string,
    saleId?: string,
  ): Promise<CollectionMessageRecord[]> {
    return this.messages
      .filter((item) => item.tenantId === tenantId)
      .filter((item) => (saleId ? item.saleId === saleId : true))
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  async insertWebhookEvent(
    record: PaymentWebhookEventRecord,
  ): Promise<'inserted' | 'duplicate'> {
    const exists = this.webhooks.some(
      (item) => item.tenantId === record.tenantId && item.eventId === record.eventId,
    );
    if (exists) {
      return 'duplicate';
    }
    this.webhooks.push({ ...record });
    return 'inserted';
  }

  async findWebhookEvent(
    tenantId: string,
    eventId: string,
  ): Promise<PaymentWebhookEventRecord | null> {
    return (
      this.webhooks.find(
        (item) => item.tenantId === tenantId && item.eventId === eventId,
      ) ?? null
    );
  }

  async updateWebhookEvent(
    tenantId: string,
    eventId: string,
    patch: {
      status: PaymentWebhookEventRecord['status'];
      installmentId?: string | null;
      paymentId?: string | null;
    },
  ): Promise<void> {
    this.webhooks = this.webhooks.map((item) =>
      item.tenantId === tenantId && item.eventId === eventId
        ? {
            ...item,
            status: patch.status,
            installmentId:
              patch.installmentId !== undefined
                ? patch.installmentId
                : item.installmentId,
            paymentId: patch.paymentId !== undefined ? patch.paymentId : item.paymentId,
          }
        : item,
    );
  }
}
