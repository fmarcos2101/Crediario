import { Inject, Injectable, Logger } from '@nestjs/common';
import { createDb } from '@crediplus/db';
import { PRODUCT_NAME } from '@crediplus/shared';
import Redis from 'ioredis';
import type { AppEnv } from '../../config/env';
import { APP_ENV } from '../../config/env.token';
import type {
  DependencyState,
  HealthLiveResponse,
  HealthReadyResponse,
} from './health.types';

const VERSION = '0.1.0';

@Injectable()
export class HealthService {
  private readonly logger = new Logger(HealthService.name);

  constructor(@Inject(APP_ENV) private readonly env: AppEnv) {}

  liveness(): HealthLiveResponse {
    return {
      status: 'ok',
      product: PRODUCT_NAME,
      version: VERSION,
    };
  }

  async readiness(): Promise<HealthReadyResponse> {
    const [postgres, redis] = await Promise.all([
      this.checkPostgres(),
      this.checkRedis(),
    ]);

    const requiredDown =
      (postgres === 'down' && this.env.DATABASE_URL) ||
      (redis === 'down' && this.env.REDIS_URL);

    return {
      status: requiredDown ? 'degraded' : 'ok',
      product: PRODUCT_NAME,
      checks: { postgres, redis },
    };
  }

  private async checkPostgres(): Promise<DependencyState> {
    if (!this.env.DATABASE_URL) {
      return 'skipped';
    }

    const { sql } = createDb(this.env.DATABASE_URL);
    try {
      await sql`select 1`;
      return 'up';
    } catch (error) {
      this.logger.warn(
        { err: error instanceof Error ? error.message : 'unknown' },
        'Postgres readiness failed',
      );
      return 'down';
    } finally {
      await sql.end({ timeout: 1 });
    }
  }

  private async checkRedis(): Promise<DependencyState> {
    if (!this.env.REDIS_URL) {
      return 'skipped';
    }

    const redis = new Redis(this.env.REDIS_URL, {
      lazyConnect: true,
      maxRetriesPerRequest: 1,
      connectTimeout: 1500,
    });

    try {
      await redis.connect();
      const pong = await redis.ping();
      return pong === 'PONG' ? 'up' : 'down';
    } catch (error) {
      this.logger.warn(
        { err: error instanceof Error ? error.message : 'unknown' },
        'Redis readiness failed',
      );
      return 'down';
    } finally {
      redis.disconnect();
    }
  }
}
