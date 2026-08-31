import { Module } from '@nestjs/common';
import type { AppEnv } from '../../config/env';
import { APP_ENV } from '../../config/env.token';
import { ConsoleEmailProvider } from '../email/email.provider';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { CsrfGuard } from './csrf.guard';
import { SessionGuard } from './session.guard';
import { AdminTenantsController } from '../tenants/admin-tenants.controller';
import {
  AUTH_REPO,
  CUSTOMER_REPO,
  RepositoriesModule,
  SALE_REPO,
  TENANT_REPO,
} from '../tenants/repositories.module';
import { TenantController } from '../tenants/tenant.controller';
import { SuperAdminGuard, TenantGuard } from '../tenants/tenant.guards';
import { TenantService } from '../tenants/tenant.service';
import { CustomerController } from '../customers/customer.controller';
import { CustomerService } from '../customers/customer.service';
import { SaleController } from '../sales/sale.controller';
import { SaleService } from '../sales/sale.service';
import type { AuthRepository } from './auth.types';
import type { CustomerRepository, TenantRepository } from '../tenants/tenant.types';
import type { SaleRepository } from '../sales/sale.types';

@Module({
  imports: [RepositoriesModule],
  controllers: [
    AuthController,
    AdminTenantsController,
    TenantController,
    CustomerController,
    SaleController,
  ],
  providers: [
    {
      provide: TenantService,
      inject: [TENANT_REPO, AUTH_REPO, APP_ENV],
      useFactory: (tenants: TenantRepository, users: AuthRepository, env: AppEnv) =>
        new TenantService(
          tenants,
          users,
          new ConsoleEmailProvider(),
          env.APP_ORIGIN,
          env.APP_ENCRYPTION_KEY,
        ),
    },
    {
      provide: CustomerService,
      inject: [CUSTOMER_REPO, APP_ENV],
      useFactory: (customers: CustomerRepository, env: AppEnv) =>
        new CustomerService(customers, env.APP_ENCRYPTION_KEY),
    },
    {
      provide: SaleService,
      inject: [SALE_REPO, CUSTOMER_REPO, TENANT_REPO],
      useFactory: (
        sales: SaleRepository,
        customers: CustomerRepository,
        tenants: TenantRepository,
      ) => new SaleService(sales, customers, tenants),
    },
    {
      provide: AuthService,
      inject: [AUTH_REPO, APP_ENV, TenantService],
      useFactory: (repo: AuthRepository, env: AppEnv, tenants: TenantService) =>
        new AuthService(repo, env, new ConsoleEmailProvider(), tenants),
    },
    SessionGuard,
    CsrfGuard,
    SuperAdminGuard,
    TenantGuard,
  ],
  exports: [AuthService, TenantService, CustomerService, SaleService],
})
export class AuthModule {}
