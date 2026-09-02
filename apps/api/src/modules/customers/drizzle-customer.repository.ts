import {
  and,
  applyRlsContext,
  customers,
  desc,
  eq,
  ilike,
  type Database,
} from '@crediplus/db';
import type { CustomerStatus } from '@crediplus/shared';
import { getRlsContext } from '../tenants/rls-als';
import type { CustomerRecord, CustomerRepository } from '../tenants/tenant.types';

export class DrizzleCustomerRepository implements CustomerRepository {
  constructor(private readonly db: Database) {}

  private async withRls<T>(fn: (tx: Database) => Promise<T>): Promise<T> {
    return this.db.transaction(async (tx) => {
      await applyRlsContext(tx, getRlsContext());
      return fn(tx as unknown as Database);
    });
  }

  async create(record: CustomerRecord): Promise<void> {
    await this.withRls(async (tx) => {
      await tx.insert(customers).values(record);
    });
  }

  async update(record: CustomerRecord): Promise<void> {
    await this.withRls(async (tx) => {
      await tx
        .update(customers)
        .set({
          name: record.name,
          phone: record.phone,
          email: record.email,
          cpfHmac: record.cpfHmac,
          cpfCiphertext: record.cpfCiphertext,
          notes: record.notes,
          status: record.status,
          updatedAt: record.updatedAt,
        })
        .where(and(eq(customers.id, record.id), eq(customers.tenantId, record.tenantId)));
    });
  }

  async findById(tenantId: string, id: string): Promise<CustomerRecord | null> {
    return this.withRls(async (tx) => {
      const rows = await tx
        .select()
        .from(customers)
        .where(and(eq(customers.tenantId, tenantId), eq(customers.id, id)))
        .limit(1);
      return rows[0] ?? null;
    });
  }

  async findByCpfHmac(tenantId: string, cpfHmac: string): Promise<CustomerRecord | null> {
    return this.withRls(async (tx) => {
      const rows = await tx
        .select()
        .from(customers)
        .where(and(eq(customers.tenantId, tenantId), eq(customers.cpfHmac, cpfHmac)))
        .limit(1);
      return rows[0] ?? null;
    });
  }

  async list(
    tenantId: string,
    query: { q?: string; status?: CustomerStatus },
  ): Promise<CustomerRecord[]> {
    return this.withRls(async (tx) => {
      const filters = [eq(customers.tenantId, tenantId)];
      if (query.status) {
        filters.push(eq(customers.status, query.status));
      }
      if (query.q && query.q.length > 0) {
        filters.push(ilike(customers.name, `%${query.q}%`));
      }
      return tx
        .select()
        .from(customers)
        .where(and(...filters))
        .orderBy(desc(customers.createdAt));
    });
  }
}
