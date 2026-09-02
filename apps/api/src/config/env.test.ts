import { describe, expect, it } from 'vitest';
import { loadEnv } from './env';

describe('loadEnv', () => {
  it('usa defaults seguros de desenvolvimento', () => {
    const env = loadEnv({
      NODE_ENV: 'development',
    });
    expect(env.API_PORT).toBe(4000);
    expect(env.CORS_ORIGINS).toEqual(['http://localhost:3000']);
  });

  it('rejeita porta inválida', () => {
    expect(() =>
      loadEnv({
        API_PORT: '99999',
      }),
    ).toThrow(/ambiente inválidas/);
  });

  it('separa origens CORS por vírgula', () => {
    const env = loadEnv({
      CORS_ORIGINS: 'http://localhost:3000, http://127.0.0.1:3000',
    });
    expect(env.CORS_ORIGINS).toEqual(['http://localhost:3000', 'http://127.0.0.1:3000']);
  });

  it('trata chaves vazias como ausentes', () => {
    const env = loadEnv({
      APP_ENCRYPTION_KEY: '',
      DATABASE_URL: '',
      REDIS_URL: '',
    });
    expect(env.APP_ENCRYPTION_KEY).toBeUndefined();
    expect(env.DATABASE_URL).toBeUndefined();
    expect(env.REDIS_URL).toBeUndefined();
  });

  it('recusa produção sem cookie seguro, chave e banco', () => {
    expect(() => loadEnv({ NODE_ENV: 'production' })).toThrow(/COOKIE_SECURE/);
    expect(() =>
      loadEnv({
        NODE_ENV: 'production',
        COOKIE_SECURE: 'true',
        APP_ENCRYPTION_KEY: Buffer.alloc(32, 1).toString('base64'),
        DATABASE_URL: 'postgres://crediplus_app@localhost/crediplus',
        CORS_ORIGINS: '*',
      }),
    ).toThrow(/CORS_ORIGINS/);
  });

  it('aceita produção com os requisitos mínimos', () => {
    const env = loadEnv({
      NODE_ENV: 'production',
      COOKIE_SECURE: 'true',
      APP_ENCRYPTION_KEY: Buffer.alloc(32, 1).toString('base64'),
      DATABASE_URL: 'postgres://crediplus_app@localhost/crediplus',
      CORS_ORIGINS: 'https://app.example.com',
    });
    expect(env.COOKIE_SECURE).toBe(true);
    expect(env.DATABASE_URL).toBeDefined();
  });
});
