import { defineConfig } from 'drizzle-kit';

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl && process.env.npm_lifecycle_event === 'migrate') {
  throw new Error('DATABASE_URL é obrigatória para aplicar migrations.');
}

export default defineConfig({
  dialect: 'postgresql',
  schema: './src/schema/index.ts',
  out: './drizzle',
  dbCredentials: {
    url:
      databaseUrl ?? 'postgres://crediplus:crediplus_dev_only@localhost:5432/crediplus',
  },
  strict: true,
  verbose: true,
});
