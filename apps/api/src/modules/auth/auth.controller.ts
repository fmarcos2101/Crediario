import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpException,
  HttpStatus,
  Inject,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { FastifyReply, FastifyRequest } from 'fastify';
import {
  forgotPasswordSchema,
  loginSchema,
  resetPasswordSchema,
  totpSchema,
} from '@crediplus/shared';
import type { z } from 'zod';
import {
  cookieBaseOptions,
  csrfCookieName,
  sessionCookieName,
} from '../../common/cookies';
import type { AppEnv } from '../../config/env';
import { APP_ENV } from '../../config/env.token';
import { AuthService, type LoginSuccess } from './auth.service';
import { CsrfGuard } from './csrf.guard';
import { SessionGuard, type AuthedRequest } from './session.guard';

function parse<T>(schema: z.ZodType<T>, body: unknown): T {
  const result = schema.safeParse(body);
  if (!result.success) {
    throw new BadRequestException('Dados inválidos.');
  }
  return result.data;
}

function clientContext(request: FastifyRequest) {
  const forwarded = request.headers['x-forwarded-for'];
  const forwardedIp = Array.isArray(forwarded) ? forwarded[0] : forwarded;
  const ip = forwardedIp?.split(',')[0]?.trim() ?? request.ip ?? null;
  const userAgent = request.headers['user-agent'] ?? null;
  return { ip, userAgent };
}

@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    @Inject(APP_ENV) private readonly env: AppEnv,
  ) {}

  @Post('login')
  async login(
    @Body() body: unknown,
    @Req() request: FastifyRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
  ) {
    const input = parse(loginSchema, body);
    const result = await this.auth.login(
      input.email,
      input.password,
      clientContext(request),
    );
    if (result.kind === 'totp') {
      return { requiresTotp: true, challengeToken: result.challengeToken };
    }
    this.setSessionCookies(reply, result);
    return { user: result.user, requiresTotp: false };
  }

  @Post('totp')
  async totp(
    @Body() body: unknown,
    @Req() request: FastifyRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
  ) {
    const input = parse(totpSchema, body);
    const result = await this.auth.verifyTotp(
      input.challengeToken,
      input.code,
      clientContext(request),
    );
    this.setSessionCookies(reply, result);
    return { user: result.user, requiresTotp: false };
  }

  @Post('logout')
  @UseGuards(SessionGuard, CsrfGuard)
  async logout(
    @Req() request: AuthedRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
  ) {
    const auth = request.auth;
    if (!auth) {
      throw new HttpException('Sessão ausente.', HttpStatus.UNAUTHORIZED);
    }
    await this.auth.logout(auth.session.id, clientContext(request), auth.user.id);
    this.clearSessionCookies(reply);
    return { ok: true };
  }

  @Get('me')
  @UseGuards(SessionGuard)
  me(@Req() request: AuthedRequest) {
    return { user: request.auth?.user };
  }

  @Post('password/forgot')
  async forgot(@Body() body: unknown, @Req() request: FastifyRequest) {
    const input = parse(forgotPasswordSchema, body);
    await this.auth.forgotPassword(input.email, clientContext(request));
    return { ok: true };
  }

  @Post('password/reset')
  async reset(@Body() body: unknown, @Req() request: FastifyRequest) {
    const input = parse(resetPasswordSchema, body);
    await this.auth.resetPassword(input.token, input.password, clientContext(request));
    return { ok: true };
  }

  private setSessionCookies(reply: FastifyReply, result: LoginSuccess): void {
    const base = cookieBaseOptions(this.env);
    const expires = result.expiresAt;
    void reply.setCookie(sessionCookieName(this.env.COOKIE_SECURE), result.sessionToken, {
      ...base,
      httpOnly: true,
      expires,
    });
    void reply.setCookie(csrfCookieName(this.env.COOKIE_SECURE), result.csrfToken, {
      ...base,
      httpOnly: false,
      expires,
    });
  }

  private clearSessionCookies(reply: FastifyReply): void {
    const base = cookieBaseOptions(this.env);
    void reply.clearCookie(sessionCookieName(this.env.COOKIE_SECURE), {
      ...base,
      httpOnly: true,
    });
    void reply.clearCookie(csrfCookieName(this.env.COOKIE_SECURE), {
      ...base,
      httpOnly: false,
    });
  }
}
