import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  Inject,
} from '@nestjs/common';
import { csrfCookieName } from '../../common/cookies';
import type { AppEnv } from '../../config/env';
import { APP_ENV } from '../../config/env.token';
import { sha256Hex } from '../../common/crypto';
import type { AuthedRequest } from './session.guard';

@Injectable()
export class CsrfGuard implements CanActivate {
  constructor(@Inject(APP_ENV) private readonly env: AppEnv) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<AuthedRequest>();
    const cookieToken = request.cookies?.[csrfCookieName(this.env.COOKIE_SECURE)];
    const header = request.headers['x-csrf-token'];
    const headerToken = Array.isArray(header) ? header[0] : header;
    const sessionHash = request.auth?.session.csrfTokenHash;
    if (!cookieToken || !headerToken || !sessionHash) {
      throw new ForbiddenException('CSRF inválido.');
    }
    if (cookieToken !== headerToken || sha256Hex(cookieToken) !== sessionHash) {
      throw new ForbiddenException('CSRF inválido.');
    }
    return true;
  }
}
