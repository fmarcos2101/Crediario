import {
  and,
  applyRlsContext,
  collectionMessages,
  desc,
  eq,
  paymentWebhookEvents,
  type Database,
} from '@crediplus/db';
import { getRlsContext } from '../tenants/rls-als';
import type {
  CollectionMessageRecord,
  CollectionRepository,
  PaymentWebhookEventRecord,
} from './collection.types';

export class DrizzleCollectionRepository implements CollectionRepository {
  constructor(private readonly db: Database) {}

  private async withRls<T>(fn: (tx: Database) => Promise<T>): Promise<T> {
    return this.db.transaction(async (tx) => {
      await applyRlsContext(tx, getRlsContext());
      return fn(tx as unknown as Database);
    });
  }

  async insertMessage(
    record: CollectionMessageRecord,
  ): Promise<'inserted' | 'duplicate'> {
    return this.withRls(async (tx) => {
      const inserted = await tx
        .insert(collectionMessages)
        .values(record)
        .onConflictDoNothing({
          target: [collectionMessages.tenantId, collectionMessages.occurrenceKey],
        })
        .returning({ id: collectionMessages.id });
      return inserted.length > 0 ? 'inserted' : 'duplicate';
    });
  }

  async listMessages(
    tenantId: string,
    saleId?: string,
  ): Promise<CollectionMessageRecord[]> {
    return this.withRls(async (tx) => {
      const filters = [eq(collectionMessages.tenantId, tenantId)];
      if (saleId) {
        filters.push(eq(collectionMessages.saleId, saleId));
      }
      return tx
        .select()
        .from(collectionMessages)
        .where(and(...filters))
        .orderBy(desc(collectionMessages.createdAt));
    });
  }

  async insertWebhookEvent(
    record: PaymentWebhookEventRecord,
  ): Promise<'inserted' | 'duplicate'> {
    return this.withRls(async (tx) => {
      const inserted = await tx
        .insert(paymentWebhookEvents)
        .values(record)
        .onConflictDoNothing({
          target: [paymentWebhookEvents.tenantId, paymentWebhookEvents.eventId],
        })
        .returning({ id: paymentWebhookEvents.id });
      return inserted.length > 0 ? 'inserted' : 'duplicate';
    });
  }

  async findWebhookEvent(
    tenantId: string,
    eventId: string,
  ): Promise<PaymentWebhookEventRecord | null> {
    return this.withRls(async (tx) => {
      const rows = await tx
        .select()
        .from(paymentWebhookEvents)
        .where(
          and(
            eq(paymentWebhookEvents.tenantId, tenantId),
            eq(paymentWebhookEvents.eventId, eventId),
          ),
        )
        .limit(1);
      return rows[0] ?? null;
    });
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
    await this.withRls(async (tx) => {
      await tx
        .update(paymentWebhookEvents)
        .set({
          status: patch.status,
          installmentId:
            patch.installmentId !== undefined ? patch.installmentId : undefined,
          paymentId: patch.paymentId !== undefined ? patch.paymentId : undefined,
        })
        .where(
          and(
            eq(paymentWebhookEvents.tenantId, tenantId),
            eq(paymentWebhookEvents.eventId, eventId),
          ),
        );
    });
  }
}
