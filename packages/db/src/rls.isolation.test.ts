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
    const files = ['0001_productive_northstar.sql', '0002_absurd_shotgun.sql'];
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

    await db.exec('RESET ROLE');
    await db.close();
  });
});
