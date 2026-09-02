import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import type { AuthedRequest } from '../auth/session.guard';

@Injectable()
export class SuperAdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<AuthedRequest>();
    if (!request.auth?.user.isSuperAdmin) {
      throw new ForbiddenException('Área restrita ao Super Admin.');
    }
    return true;
  }
}

@Injectable()
export class TenantGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<AuthedRequest>();
    if (request.auth?.user.isSuperAdmin) {
      throw new ForbiddenException('Use o painel administrativo.');
    }
    if (!request.auth?.user.tenantId) {
      throw new ForbiddenException('Empresa não identificada.');
    }
    return true;
  }
}
