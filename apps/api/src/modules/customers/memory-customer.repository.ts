import type { CustomerStatus } from '@crediplus/shared';
import type { CustomerRecord, CustomerRepository } from '../tenants/tenant.types';

export class MemoryCustomerRepository implements CustomerRepository {
  items: CustomerRecord[] = [];

  async create(record: CustomerRecord): Promise<void> {
    this.items.push({ ...record });
  }

  async update(record: CustomerRecord): Promise<void> {
    this.items = this.items.map((item) => (item.id === record.id ? { ...record } : item));
  }

  async findById(tenantId: string, id: string): Promise<CustomerRecord | null> {
    return (
      this.items.find((item) => item.tenantId === tenantId && item.id === id) ?? null
    );
  }

  async findByCpfHmac(tenantId: string, cpfHmac: string): Promise<CustomerRecord | null> {
    return (
      this.items.find((item) => item.tenantId === tenantId && item.cpfHmac === cpfHmac) ??
      null
    );
  }

  async list(
    tenantId: string,
    query: { q?: string; status?: CustomerStatus },
  ): Promise<CustomerRecord[]> {
    const needle = query.q?.trim().toLowerCase();
    return this.items
      .filter((item) => item.tenantId === tenantId)
      .filter((item) => (query.status ? item.status === query.status : true))
      .filter((item) => (needle ? item.name.toLowerCase().includes(needle) : true))
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }
}
