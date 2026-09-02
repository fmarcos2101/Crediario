import { Module } from '@nestjs/common';
import type { Database } from '@crediplus/db';
import { APP_ENV } from '../../config/env.token';
import type { AppEnv } from '../../config/env';
import { DATABASE, DatabaseModule } from '../database/database.module';
import { DrizzleAuthRepository } from '../auth/drizzle-auth.repository';
import { MemoryAuthRepository } from '../auth/memory-auth.repository';
import { DrizzleCustomerRepository } from '../customers/drizzle-customer.repository';
import { MemoryCustomerRepository } from '../customers/memory-customer.repository';
import { DrizzleCollectionRepository } from '../collection/drizzle-collection.repository';
import { MemoryCollectionRepository } from '../collection/memory-collection.repository';
import { DrizzleSaleRepository } from '../sales/drizzle-sale.repository';
import { MemorySaleRepository } from '../sales/memory-sale.repository';
import { DrizzleTenantRepository } from './drizzle-tenant.repository';
import { MemoryTenantRepository } from './memory-tenant.repository';
import type { AuthRepository } from '../auth/auth.types';
import type { CollectionRepository } from '../collection/collection.types';
import type { CustomerRepository, TenantRepository } from './tenant.types';
import type { SaleRepository } from '../sales/sale.types';

export const AUTH_REPO = Symbol('AUTH_REPO');
export const TENANT_REPO = Symbol('TENANT_REPO');
export const CUSTOMER_REPO = Symbol('CUSTOMER_REPO');
export const SALE_REPO = Symbol('SALE_REPO');
export const COLLECTION_REPO = Symbol('COLLECTION_REPO');

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
    {
      provide: CUSTOMER_REPO,
      inject: [DATABASE, APP_ENV],
      useFactory: (db: Database | null, env: AppEnv): CustomerRepository => {
        if (!db && env.NODE_ENV === 'production') {
          throw new Error('DATABASE_URL é obrigatória em produção.');
        }
        return db ? new DrizzleCustomerRepository(db) : new MemoryCustomerRepository();
      },
    },
    {
      provide: SALE_REPO,
      inject: [DATABASE, APP_ENV],
      useFactory: (db: Database | null, env: AppEnv): SaleRepository => {
        if (!db && env.NODE_ENV === 'production') {
          throw new Error('DATABASE_URL é obrigatória em produção.');
        }
        return db ? new DrizzleSaleRepository(db) : new MemorySaleRepository();
      },
    },
    {
      provide: COLLECTION_REPO,
      inject: [DATABASE, APP_ENV],
      useFactory: (db: Database | null, env: AppEnv): CollectionRepository => {
        if (!db && env.NODE_ENV === 'production') {
          throw new Error('DATABASE_URL é obrigatória em produção.');
        }
        return db
          ? new DrizzleCollectionRepository(db)
          : new MemoryCollectionRepository();
      },
    },
  ],
  exports: [AUTH_REPO, TENANT_REPO, CUSTOMER_REPO, SALE_REPO, COLLECTION_REPO],
})
export class RepositoriesModule {}
