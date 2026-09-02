import type {
  CollectionChannel,
  CollectionKind,
  CollectionMessageStatus,
  PaymentWebhookStatus,
} from '@crediplus/shared';

export type CollectionMessageRecord = {
  id: string;
  tenantId: string;
  saleId: string;
  installmentId: string;
  paymentId: string | null;
  kind: CollectionKind;
  channel: CollectionChannel;
  status: CollectionMessageStatus;
  occurrenceKey: string;
  recipient: string | null;
  body: string;
  createdAt: Date;
};

export type PaymentWebhookEventRecord = {
  id: string;
  tenantId: string;
  eventId: string;
  installmentId: string | null;
  paymentId: string | null;
  status: PaymentWebhookStatus;
  payload: string;
  createdAt: Date;
};

export type CollectionRepository = {
  insertMessage(record: CollectionMessageRecord): Promise<'inserted' | 'duplicate'>;
  listMessages(tenantId: string, saleId?: string): Promise<CollectionMessageRecord[]>;
  insertWebhookEvent(
    record: PaymentWebhookEventRecord,
  ): Promise<'inserted' | 'duplicate'>;
  findWebhookEvent(
    tenantId: string,
    eventId: string,
  ): Promise<PaymentWebhookEventRecord | null>;
  updateWebhookEvent(
    tenantId: string,
    eventId: string,
    patch: {
      status: PaymentWebhookStatus;
      installmentId?: string | null;
      paymentId?: string | null;
    },
  ): Promise<void>;
};
