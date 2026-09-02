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
      '0004_bright_sister_grimm.sql',
      '0005_clammy_brood.sql',
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
      INSERT INTO sales (
        id, tenant_id, customer_id, status, total_amount, down_payment,
        financed_amount, installment_count, first_due_date
      ) VALUES
        ('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee', '${tenantA}', 'cccccccc-cccc-4ccc-8ccc-cccccccccccc', 'open', '100.00', '0.00', '100.00', 1, '2026-04-01'),
        ('ffffffff-ffff-4fff-8fff-ffffffffffff', '${tenantB}', 'dddddddd-dddd-4ddd-8ddd-dddddddddddd', 'open', '200.00', '0.00', '200.00', 1, '2026-04-01');
      INSERT INTO installments (
        id, tenant_id, sale_id, sequence, due_date, amount, paid_amount, status
      ) VALUES
        ('55555555-5555-4555-8555-555555555555', '${tenantA}', 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee', 1, '2026-04-01', '100.00', '0.00', 'OPEN'),
        ('66666666-6666-4666-8666-666666666666', '${tenantB}', 'ffffffff-ffff-4fff-8fff-ffffffffffff', 1, '2026-04-01', '200.00', '0.00', 'OPEN');
      INSERT INTO sale_status_history (id, tenant_id, sale_id, to_status, reason)
      VALUES
        ('11111111-1111-4111-8111-111111111111', '${tenantA}', 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee', 'open', 'created'),
        ('22222222-2222-4222-8222-222222222222', '${tenantB}', 'ffffffff-ffff-4fff-8fff-ffffffffffff', 'open', 'created');
      INSERT INTO collection_messages (
        id, tenant_id, sale_id, installment_id, kind, channel, status, occurrence_key, body
      ) VALUES
        ('77777777-7777-4777-8777-777777777777', '${tenantA}', 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee', '55555555-5555-4555-8555-555555555555', 'due_reminder', 'none', 'skipped_no_channel', 'due_reminder:a:2026-04-01', 'Olá A'),
        ('88888888-8888-4888-8888-888888888888', '${tenantB}', 'ffffffff-ffff-4fff-8fff-ffffffffffff', '66666666-6666-4666-8666-666666666666', 'due_reminder', 'none', 'skipped_no_channel', 'due_reminder:b:2026-04-01', 'Olá B');
      INSERT INTO payment_webhook_events (id, tenant_id, event_id, status, payload)
      VALUES
        ('33333333-3333-4333-8333-333333333333', '${tenantA}', 'evt-a', 'applied', '{}'),
        ('44444444-4444-4444-8444-444444444444', '${tenantB}', 'evt-b', 'applied', '{}');
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

    const ownSales = await db.query<{ id: string }>('SELECT id FROM sales');
    expect(ownSales.rows.map((row) => row.id)).toEqual([
      'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
    ]);
    const ownHistory = await db.query<{ sale_id: string }>(
      'SELECT sale_id FROM sale_status_history',
    );
    expect(ownHistory.rows.map((row) => row.sale_id)).toEqual([
      'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
    ]);
    const ownWebhooks = await db.query<{ event_id: string }>(
      'SELECT event_id FROM payment_webhook_events',
    );
    expect(ownWebhooks.rows.map((row) => row.event_id)).toEqual(['evt-a']);
    const ownMessages = await db.query<{ occurrence_key: string }>(
      'SELECT occurrence_key FROM collection_messages',
    );
    expect(ownMessages.rows.map((row) => row.occurrence_key)).toEqual([
      'due_reminder:a:2026-04-01',
    ]);

    await db.exec(`SELECT set_config('app.is_super_admin', 'true', false)`);
    await db.exec(`SELECT set_config('app.current_tenant_id', '', false)`);
    const superCustomers = await db.query<{ name: string }>('SELECT name FROM customers');
    expect(superCustomers.rows).toEqual([]);
    const superSecrets = await db.query<{ tenant_id: string }>(
      'SELECT tenant_id FROM tenant_secrets',
    );
    expect(superSecrets.rows).toEqual([]);
    const superSales = await db.query<{ id: string }>('SELECT id FROM sales');
    expect(superSales.rows).toEqual([]);
    const superHistory = await db.query<{ sale_id: string }>(
      'SELECT sale_id FROM sale_status_history',
    );
    expect(superHistory.rows).toEqual([]);
    const superWebhooks = await db.query<{ event_id: string }>(
      'SELECT event_id FROM payment_webhook_events',
    );
    expect(superWebhooks.rows).toEqual([]);
    const superMessages = await db.query<{ occurrence_key: string }>(
      'SELECT occurrence_key FROM collection_messages',
    );
    expect(superMessages.rows).toEqual([]);

    await db.exec('RESET ROLE');
    await db.close();
  });
});
