import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { FastifyReply, FastifyRequest } from 'fastify';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const reply = ctx.getResponse<FastifyReply>();
    const request = ctx.getRequest<FastifyRequest>();
    const requestId = request.id;

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const publicMessage =
      exception instanceof HttpException
        ? this.publicMessage(exception)
        : 'Erro interno. Tente novamente.';

    const code =
      exception instanceof HttpException ? this.codeFromStatus(status) : 'INTERNAL_ERROR';

    if (status >= 500) {
      this.logger.error(
        {
          requestId,
          err: exception instanceof Error ? exception.message : 'unknown',
        },
        'Unhandled error',
      );
    }

    const details = this.safeDetails(exception);

    void reply.status(status).send({
      error: {
        code,
        message: publicMessage,
        requestId,
        ...(details ? { details } : {}),
      },
    });
  }

  private publicMessage(exception: HttpException): string {
    const payload = exception.getResponse();
    if (typeof payload === 'string') {
      return payload;
    }
    if (typeof payload === 'object' && payload && 'message' in payload) {
      const message = payload.message;
      if (typeof message === 'string') {
        return message;
      }
    }
    return exception.message;
  }

  private safeDetails(exception: unknown): Record<string, unknown> | undefined {
    if (!(exception instanceof HttpException)) {
      return undefined;
    }
    const payload = exception.getResponse();
    if (typeof payload !== 'object' || !payload || !('checks' in payload)) {
      return undefined;
    }
    return { checks: payload.checks };
  }

  private codeFromStatus(status: number): string {
    if (status === HttpStatus.SERVICE_UNAVAILABLE) {
      return 'HEALTH_DEPENDENCY_UNAVAILABLE';
    }
    if (status === HttpStatus.BAD_REQUEST) {
      return 'BAD_REQUEST';
    }
    if (status === HttpStatus.UNAUTHORIZED) {
      return 'UNAUTHORIZED';
    }
    if (status === HttpStatus.FORBIDDEN) {
      return 'FORBIDDEN';
    }
    if (status === HttpStatus.NOT_FOUND) {
      return 'NOT_FOUND';
    }
    if (status >= 500) {
      return 'INTERNAL_ERROR';
    }
    return 'REQUEST_FAILED';
  }
}
