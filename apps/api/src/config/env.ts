import { z } from 'zod';

const booleanFromEnv = z
  .enum(['true', 'false'])
  .default('false')
  .transform((value) => value === 'true');

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  API_PORT: z.coerce.number().int().min(1).max(65535).default(4000),
  APP_ORIGIN: z.string().url().default('http://localhost:3000'),
  API_ORIGIN: z.string().url().default('http://localhost:4000'),
  CORS_ORIGINS: z
    .string()
    .default('http://localhost:3000')
    .transform((value) =>
      value
        .split(',')
        .map((origin) => origin.trim())
        .filter((origin) => origin.length > 0),
    ),
  DATABASE_URL: z.preprocess(
    (value) => (typeof value === 'string' && value.length === 0 ? undefined : value),
    z.string().min(1).optional(),
  ),
  REDIS_URL: z.preprocess(
    (value) => (typeof value === 'string' && value.length === 0 ? undefined : value),
    z.string().min(1).optional(),
  ),
  COOKIE_SECURE: booleanFromEnv,
  COOKIE_DOMAIN: z.string().optional(),
  SESSION_TTL_HOURS: z.coerce.number().positive().default(12),
  SUPERADMIN_SESSION_TTL_HOURS: z.coerce.number().positive().default(4),
  SUPERADMIN_IDLE_MINUTES: z.coerce.number().positive().default(30),
  APP_ENCRYPTION_KEY: z.preprocess(
    (value) => (typeof value === 'string' && value.length === 0 ? undefined : value),
    z.string().min(1).optional(),
  ),
  EMAIL_FROM: z.string().default('CrediPlus <dev@localhost>'),
  BOOTSTRAP_SUPERADMIN_EMAIL: z.string().default(''),
  BOOTSTRAP_SUPERADMIN_PASSWORD: z.string().default(''),
});

export type AppEnv = z.infer<typeof envSchema>;

export function loadEnv(source: NodeJS.ProcessEnv = process.env): AppEnv {
  const parsed = envSchema.safeParse(source);
  if (!parsed.success) {
    const details = parsed.error.issues
      .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
      .join('; ');
    throw new Error(`Variáveis de ambiente inválidas: ${details}`);
  }
  return parsed.data;
}
