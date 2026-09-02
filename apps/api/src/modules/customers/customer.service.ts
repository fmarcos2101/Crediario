import { HttpException, HttpStatus } from '@nestjs/common';
import {
  formatCpf,
  isValidCpf,
  maskCpf,
  normalizeCpf,
  normalizeEmail,
  type CreateCustomerInput,
  type CustomerStatus,
  type UpdateCustomerInput,
} from '@crediplus/shared';
import { v7 as uuidv7 } from 'uuid';
import { decryptString, encryptString, hmacSha256Hex } from '../../common/crypto';
import { runWithRls } from '../tenants/rls-als';
import type { CustomerRecord, CustomerRepository } from '../tenants/tenant.types';

const NOT_FOUND = 'Recurso não encontrado.';

export type PublicCustomer = {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  cpfMasked: string;
  cpf: string | null;
  notes: string | null;
  status: CustomerStatus;
  createdAt: Date;
};

export class CustomerService {
  constructor(
    private readonly customers: CustomerRepository,
    private readonly encryptionKey: string | undefined,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async list(
    tenantId: string,
    query: { q?: string; status?: CustomerStatus },
  ): Promise<PublicCustomer[]> {
    const key = this.requireKey();
    const cpfQuery = query.q ? normalizeCpf(query.q) : '';
    return runWithRls({ tenantId, isSuperAdmin: false }, async () => {
      if (cpfQuery.length === 11 && isValidCpf(cpfQuery)) {
        const found = await this.customers.findByCpfHmac(
          tenantId,
          hmacSha256Hex(cpfQuery, key),
        );
        return found && (!query.status || found.status === query.status)
          ? [this.toPublic(found, key, false)]
          : [];
      }
      const rows = await this.customers.list(tenantId, query);
      return rows.map((row) => this.toPublic(row, key, false));
    });
  }

  async get(tenantId: string, id: string): Promise<PublicCustomer> {
    const key = this.requireKey();
    const row = await runWithRls({ tenantId, isSuperAdmin: false }, () =>
      this.customers.findById(tenantId, id),
    );
    if (!row) {
      throw new HttpException(NOT_FOUND, HttpStatus.NOT_FOUND);
    }
    return this.toPublic(row, key, true);
  }

  async create(tenantId: string, input: CreateCustomerInput): Promise<PublicCustomer> {
    const key = this.requireKey();
    const cpf = normalizeCpf(input.cpf);
    const hmac = hmacSha256Hex(cpf, key);
    const now = this.now();
    return runWithRls({ tenantId, isSuperAdmin: false }, async () => {
      const existing = await this.customers.findByCpfHmac(tenantId, hmac);
      if (existing && existing.status === 'active') {
        throw new HttpException('Já existe cliente com este CPF.', HttpStatus.CONFLICT);
      }
      if (existing) {
        const updated: CustomerRecord = {
          ...existing,
          name: input.name.trim(),
          phone: input.phone ?? null,
          email: input.email ? normalizeEmail(input.email) : null,
          notes: input.notes ?? null,
          cpfHmac: hmac,
          cpfCiphertext: encryptString(cpf, key),
          status: 'active',
          updatedAt: now,
        };
        await this.customers.update(updated);
        return this.toPublic(updated, key, true);
      }
      const record: CustomerRecord = {
        id: uuidv7(),
        tenantId,
        name: input.name.trim(),
        phone: input.phone ?? null,
        email: input.email ? normalizeEmail(input.email) : null,
        cpfHmac: hmac,
        cpfCiphertext: encryptString(cpf, key),
        notes: input.notes ?? null,
        status: 'active',
        createdAt: now,
        updatedAt: now,
      };
      await this.customers.create(record);
      return this.toPublic(record, key, true);
    });
  }

  async update(
    tenantId: string,
    id: string,
    input: UpdateCustomerInput,
  ): Promise<PublicCustomer> {
    const key = this.requireKey();
    return runWithRls({ tenantId, isSuperAdmin: false }, async () => {
      const current = await this.customers.findById(tenantId, id);
      if (!current) {
        throw new HttpException(NOT_FOUND, HttpStatus.NOT_FOUND);
      }
      let hmac = current.cpfHmac;
      let ciphertext = current.cpfCiphertext;
      if (input.cpf) {
        const cpf = normalizeCpf(input.cpf);
        hmac = hmacSha256Hex(cpf, key);
        const clash = await this.customers.findByCpfHmac(tenantId, hmac);
        if (clash && clash.id !== id) {
          throw new HttpException('Já existe cliente com este CPF.', HttpStatus.CONFLICT);
        }
        ciphertext = encryptString(cpf, key);
      }
      const email =
        input.email === undefined
          ? current.email
          : input.email
            ? normalizeEmail(input.email)
            : null;
      const next: CustomerRecord = {
        ...current,
        name: input.name ?? current.name,
        phone: input.phone === undefined ? current.phone : input.phone,
        email,
        notes: input.notes === undefined ? current.notes : input.notes,
        cpfHmac: hmac,
        cpfCiphertext: ciphertext,
        updatedAt: this.now(),
      };
      await this.customers.update(next);
      return this.toPublic(next, key, true);
    });
  }

  async archive(tenantId: string, id: string): Promise<void> {
    await runWithRls({ tenantId, isSuperAdmin: false }, async () => {
      const current = await this.customers.findById(tenantId, id);
      if (!current) {
        throw new HttpException(NOT_FOUND, HttpStatus.NOT_FOUND);
      }
      await this.customers.update({
        ...current,
        status: 'archived',
        updatedAt: this.now(),
      });
    });
  }

  private requireKey(): string {
    if (!this.encryptionKey) {
      throw new HttpException(
        'Criptografia não configurada para cadastro de clientes.',
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
    return this.encryptionKey;
  }

  private toPublic(
    row: CustomerRecord,
    key: string,
    includeCpf: boolean,
  ): PublicCustomer {
    const cpf = decryptString(row.cpfCiphertext, key);
    return {
      id: row.id,
      name: row.name,
      phone: row.phone,
      email: row.email,
      cpfMasked: maskCpf(cpf),
      cpf: includeCpf ? formatCpf(cpf) : null,
      notes: row.notes,
      status: row.status,
      createdAt: row.createdAt,
    };
  }
}
