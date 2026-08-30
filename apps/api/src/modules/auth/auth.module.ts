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
  RepositoriesModule,
  TENANT_REPO,
} from '../tenants/repositories.module';
import { TenantController } from '../tenants/tenant.controller';
import { SuperAdminGuard, TenantGuard } from '../tenants/tenant.guards';
import { TenantService } from '../tenants/tenant.service';
import type { AuthRepository } from './auth.types';
import type { TenantRepository } from '../tenants/tenant.types';

@Module({
  imports: [RepositoriesModule],
  controllers: [AuthController, AdminTenantsController, TenantController],
  providers: [
    {
      provide: TenantService,
      inject: [TENANT_REPO, AUTH_REPO, APP_ENV],
      useFactory: (tenants: TenantRepository, users: AuthRepository, env: AppEnv) =>
        new TenantService(tenants, users, new ConsoleEmailProvider(), env.APP_ORIGIN),
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
  exports: [AuthService, TenantService],
})
export class AuthModule {}
