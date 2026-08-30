import { Module } from '@nestjs/common';
import type { Database } from '@crediplus/db';
import { APP_ENV } from '../../config/env.token';
import type { AppEnv } from '../../config/env';
import { DATABASE, DatabaseModule } from '../database/database.module';
import { DrizzleAuthRepository } from '../auth/drizzle-auth.repository';
import { MemoryAuthRepository } from '../auth/memory-auth.repository';
import { DrizzleTenantRepository } from './drizzle-tenant.repository';
import { MemoryTenantRepository } from './memory-tenant.repository';
import type { AuthRepository } from '../auth/auth.types';
import type { TenantRepository } from './tenant.types';

export const AUTH_REPO = Symbol('AUTH_REPO');
export const TENANT_REPO = Symbol('TENANT_REPO');

@Module({
  imports: [DatabaseModule],
  providers: [
    {
      provide: AUTH_REPO,
      inject: [DATABASE, APP_ENV],
      useFactory: (db: Database | null, env: AppEnv): AuthRepository => {
        if (!db && env.NODE_ENV === 'production') {
          throw new Error('DATABASE_URL é obrigatória em produção.');
        }
        return db ? new DrizzleAuthRepository(db) : new MemoryAuthRepository();
      },
    },
    {
      provide: TENANT_REPO,
      inject: [DATABASE, APP_ENV],
      useFactory: (db: Database | null, env: AppEnv): TenantRepository => {
        if (!db && env.NODE_ENV === 'production') {
          throw new Error('DATABASE_URL é obrigatória em produção.');
        }
        return db ? new DrizzleTenantRepository(db) : new MemoryTenantRepository();
      },
    },
  ],
  exports: [AUTH_REPO, TENANT_REPO],
})
export class RepositoriesModule {}
