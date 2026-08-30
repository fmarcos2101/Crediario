import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { config as loadDotEnv } from 'dotenv';
import { loadEnv } from '../config/env';
import { createDb } from '@crediplus/db';
import { AuthService } from '../modules/auth/auth.service';
import { DrizzleAuthRepository } from '../modules/auth/drizzle-auth.repository';
import { ConsoleEmailProvider } from '../modules/email/email.provider';

function hydrateEnv(): void {
  for (const path of [
    resolve(process.cwd(), '.env'),
    resolve(process.cwd(), '../../.env'),
  ]) {
    if (existsSync(path)) {
      loadDotEnv({ path, override: false });
    }
  }
}

async function main(): Promise<void> {
  hydrateEnv();
  const env = loadEnv();
  if (!env.DATABASE_URL) {
    throw new Error('DATABASE_URL é obrigatória.');
  }
  if (!env.BOOTSTRAP_SUPERADMIN_EMAIL || !env.BOOTSTRAP_SUPERADMIN_PASSWORD) {
    throw new Error(
      'BOOTSTRAP_SUPERADMIN_EMAIL e BOOTSTRAP_SUPERADMIN_PASSWORD são obrigatórios.',
    );
  }

  const { db, sql } = createDb(env.DATABASE_URL);
  try {
    const auth = new AuthService(
      new DrizzleAuthRepository(db),
      env,
      new ConsoleEmailProvider(),
    );
    const result = await auth.bootstrapSuperAdmin(
      env.BOOTSTRAP_SUPERADMIN_EMAIL,
      env.BOOTSTRAP_SUPERADMIN_PASSWORD,
    );
    console.log('Super Admin criado:', result.email);
    console.log('Cadastre este TOTP no autenticador (não será exibido de novo):');
    console.log(result.otpauthUrl);
  } finally {
    await sql.end({ timeout: 5 });
  }
}

void main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
