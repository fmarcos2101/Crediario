import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type { FastifyRequest } from 'fastify';
import { sessionCookieName } from '../../common/cookies';
import { APP_ENV } from '../../config/env.token';
import type { AppEnv } from '../../config/env';
import { Inject } from '@nestjs/common';
import type { PublicUser } from '@crediplus/shared';
import type { SessionRecord } from './auth.types';
import { AuthService } from './auth.service';

export type AuthedRequest = FastifyRequest & {
  auth?: {
    user: PublicUser;
    session: SessionRecord;
  };
};

@Injectable()
export class SessionGuard implements CanActivate {
  constructor(
    private readonly auth: AuthService,
    @Inject(APP_ENV) private readonly env: AppEnv,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthedRequest>();
    const token = request.cookies?.[sessionCookieName(this.env.COOKIE_SECURE)];
    if (!token) {
      throw new UnauthorizedException('Sessão ausente.');
    }
    const resolved = await this.auth.resolveSession(token);
    if (!resolved) {
      throw new UnauthorizedException('Sessão inválida.');
    }
    request.auth = resolved;
    return true;
  }
}
