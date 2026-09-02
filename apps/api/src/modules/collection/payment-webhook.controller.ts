import { Controller, Headers, Param, Post, Req } from '@nestjs/common';
import type { FastifyRequest } from 'fastify';
import { CollectionService } from './collection.service';

@Controller('webhooks/payments')
export class PaymentWebhookController {
  constructor(private readonly collection: CollectionService) {}

  @Post(':tenantId')
  handle(
    @Param('tenantId') tenantId: string,
    @Req() request: FastifyRequest & { rawBody?: string },
    @Headers('x-webhook-signature') signature?: string,
  ) {
    const forwarded = request.headers['x-forwarded-for'];
    const forwardedIp = Array.isArray(forwarded) ? forwarded[0] : forwarded;
    const ip = forwardedIp?.split(',')[0]?.trim() ?? request.ip ?? 'unknown';
    const header = Array.isArray(signature) ? signature[0] : signature;
    return this.collection.handlePaymentWebhook({
      tenantId,
      rawBody: request.rawBody ?? '',
      signature: header,
      ip,
    });
  }
}
