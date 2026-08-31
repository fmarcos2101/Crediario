import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PGlite } from '@electric-sql/pglite';
import { describe, expect, it } from 'vitest';

const drizzleDir = join(dirname(fileURLToPath(import.meta.url)), '../drizzle');

function loadSql(name: string): string[] {
  const path = join(drizzleDir, name);
  if (!existsSync(path)) {
    throw new Error(`Migration ausente: ${name}`);
  }
  return readFileSync(path, 'utf8')
    .split('--> statement-breakpoint')
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
}

describe('RLS isolamento multi-tenant', () => {
  it('Tenant A não lê settings de Tenant B', async () => {
    const db = new PGlite();
    const files = [
      '0001_productive_northstar.sql',
      '0002_absurd_shotgun.sql',
      '0003_nifty_hulk.sql',
    ];
    for (const file of files) {
      for (const statement of loadSql(file)) {
        await db.exec(statement);
      }
    }

    await db.exec(`
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'crediplus_app') THEN
          CREATE ROLE crediplus_app NOLOGIN NOSUPERUSER NOBYPASSRLS;
        END IF;
      END $$;
      GRANT USAGE ON SCHEMA public TO crediplus_app;
      GRANT SELECT, INSERT, UPDATE ON ALL TABLES IN SCHEMA public TO crediplus_app;
    `);

    const tenantA = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
    const tenantB = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

    await db.exec(`
      INSERT INTO tenants (id, name, status) VALUES
        ('${tenantA}', 'Loja A', 'active'),
        ('${tenantB}', 'Loja B', 'active');
      INSERT INTO tenant_settings (tenant_id) VALUES ('${tenantA}'), ('${tenantB}');
      INSERT INTO customers (id, tenant_id, name, cpf_hmac, cpf_ciphertext)
      VALUES
        ('cccccccc-cccc-4ccc-8ccc-cccccccccccc', '${tenantA}', 'Maria A', 'hmac-a', 'cipher-a'),
        ('dddddddd-dddd-4ddd-8ddd-dddddddddddd', '${tenantB}', 'Maria B', 'hmac-b', 'cipher-b');
      INSERT INTO tenant_secrets (tenant_id, payment_api_key_ciphertext)
      VALUES ('${tenantA}', 'cipher-pay-a'), ('${tenantB}', 'cipher-pay-b');
    `);

    await db.exec(`SET ROLE crediplus_app`);
    await db.exec(`SELECT set_config('app.current_tenant_id', '${tenantA}', false)`);
    await db.exec(`SELECT set_config('app.is_super_admin', 'false', false)`);

    const own = await db.query<{ tenant_id: string }>(
      'SELECT tenant_id FROM tenant_settings WHERE tenant_id = $1',
      [tenantA],
    );
    const foreign = await db.query<{ tenant_id: string }>(
      'SELECT tenant_id FROM tenant_settings WHERE tenant_id = $1',
      [tenantB],
    );
    const listed = await db.query<{ tenant_id: string }>(
      'SELECT tenant_id FROM tenant_settings ORDER BY tenant_id',
    );

    expect(own.rows.map((row) => row.tenant_id)).toEqual([tenantA]);
    expect(foreign.rows).toEqual([]);
    expect(listed.rows.map((row) => row.tenant_id)).toEqual([tenantA]);

    const ownCustomers = await db.query<{ name: string }>(
      'SELECT name FROM customers ORDER BY name',
    );
    const foreignCustomer = await db.query<{ name: string }>(
      'SELECT name FROM customers WHERE tenant_id = $1',
      [tenantB],
    );
    expect(ownCustomers.rows.map((row) => row.name)).toEqual(['Maria A']);
    expect(foreignCustomer.rows).toEqual([]);

    const ownSecrets = await db.query<{ tenant_id: string }>(
      'SELECT tenant_id FROM tenant_secrets',
    );
    expect(ownSecrets.rows.map((row) => row.tenant_id)).toEqual([tenantA]);
    const foreignSecrets = await db.query<{ tenant_id: string }>(
      'SELECT tenant_id FROM tenant_secrets WHERE tenant_id = $1',
      [tenantB],
    );
    expect(foreignSecrets.rows).toEqual([]);

    await db.exec(`SELECT set_config('app.is_super_admin', 'true', false)`);
    await db.exec(`SELECT set_config('app.current_tenant_id', '', false)`);
    const superCustomers = await db.query<{ name: string }>('SELECT name FROM customers');
    expect(superCustomers.rows).toEqual([]);
    const superSecrets = await db.query<{ tenant_id: string }>(
      'SELECT tenant_id FROM tenant_secrets',
    );
    expect(superSecrets.rows).toEqual([]);

    await db.exec('RESET ROLE');
    await db.close();
  });
});
