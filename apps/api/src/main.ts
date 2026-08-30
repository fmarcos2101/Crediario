import { existsSync } from 'node:fs';
import type { IncomingMessage } from 'node:http';
import { resolve } from 'node:path';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import cors from '@fastify/cors';
import cookie from '@fastify/cookie';
import helmet from '@fastify/helmet';
import { config as loadDotEnv } from 'dotenv';
import { API_PREFIX, PRODUCT_NAME } from '@crediplus/shared';
import { AppModule } from './app.module';
import { resolveRequestId } from './common/request-id';
import { loadEnv } from './config/env';

function hydrateEnv(): void {
  for (const path of [
    resolve(process.cwd(), '.env'),
    resolve(process.cwd(), '../../.env'),
  ]) {
    if (existsSync(path)) {
      loadDotEnv({ path, override: false });
    }
  }
}

async function bootstrap(): Promise<void> {
  hydrateEnv();
  const env = loadEnv();
  const logger = new Logger('Bootstrap');

  const adapter = new FastifyAdapter({
    logger: env.NODE_ENV !== 'production',
    genReqId: (request: IncomingMessage) => resolveRequestId(request.headers),
    requestIdHeader: 'x-request-id',
    trustProxy: env.NODE_ENV === 'production',
  });

  const app = await NestFactory.create<NestFastifyApplication>(AppModule, adapter, {
    logger: ['error', 'warn', 'log'],
  });

  await app.register(helmet, {
    global: true,
    contentSecurityPolicy: false,
  });

  await app.register(cookie);

  await app.register(cors, {
    origin: env.CORS_ORIGINS,
    credentials: true,
    methods: ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'X-Request-Id', 'X-CSRF-Token'],
  });

  app.setGlobalPrefix(API_PREFIX.replace(/^\//, ''));

  const host = env.NODE_ENV === 'production' ? '0.0.0.0' : '127.0.0.1';
  await app.listen(env.API_PORT, host);

  logger.log(`${PRODUCT_NAME} API em ${env.API_ORIGIN}${API_PREFIX}`);
}

void bootstrap();
