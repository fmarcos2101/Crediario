import { describe, expect, it } from 'vitest';
import type { AppEnv } from '../../config/env';
import { loadEnv } from '../../config/env';
import { HealthService } from './health.service';

const env: AppEnv = loadEnv({ NODE_ENV: 'test' });

describe('HealthService', () => {
  it('liveness não consulta dependências', () => {
    const service = new HealthService(env);
    expect(service.liveness()).toEqual({
      status: 'ok',
      product: 'CrediPlus',
      version: '0.1.0',
    });
  });

  it('readiness marca postgres e redis como skipped sem URLs', async () => {
    const service = new HealthService(env);
    await expect(service.readiness()).resolves.toEqual({
      status: 'ok',
      product: 'CrediPlus',
      checks: {
        postgres: 'skipped',
        redis: 'skipped',
      },
    });
  });
});
