import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpException,
  HttpStatus,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  createSaleSchema,
  listSalesQuerySchema,
  recordPaymentSchema,
  reversePaymentSchema,
} from '@crediplus/shared';
import { CsrfGuard } from '../auth/csrf.guard';
import { SessionGuard, type AuthedRequest } from '../auth/session.guard';
import { TenantGuard } from '../tenants/tenant.guards';
import { SaleService } from './sale.service';

@Controller('sales')
@UseGuards(SessionGuard, TenantGuard)
export class SaleController {
  constructor(private readonly sales: SaleService) {}

  @Get()
  list(@Req() request: AuthedRequest, @Query() query: Record<string, unknown>) {
    const tenantId = this.requireTenant(request);
    const parsed = listSalesQuerySchema.safeParse(query);
    if (!parsed.success) {
      throw new BadRequestException('Dados inválidos.');
    }
    return this.sales.list(tenantId, parsed.data);
  }

  @Get(':id')
  get(@Req() request: AuthedRequest, @Param('id') id: string) {
    return this.sales.get(this.requireTenant(request), id);
  }

  @Post()
  @UseGuards(CsrfGuard)
  create(@Req() request: AuthedRequest, @Body() body: unknown) {
    const parsed = createSaleSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException('Dados inválidos.');
    }
    return this.sales.create(this.requireTenant(request), parsed.data);
  }

  @Post(':id/cancel')
  @UseGuards(CsrfGuard)
  cancel(@Req() request: AuthedRequest, @Param('id') id: string) {
    return this.sales.cancel(this.requireTenant(request), id);
  }

  @Post(':id/payments')
  @UseGuards(CsrfGuard)
  pay(@Req() request: AuthedRequest, @Param('id') id: string, @Body() body: unknown) {
    const parsed = recordPaymentSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException('Dados inválidos.');
    }
    return this.sales.recordPayment(this.requireTenant(request), id, parsed.data);
  }

  @Post(':id/payments/:paymentId/reverse')
  @UseGuards(CsrfGuard)
  reverse(
    @Req() request: AuthedRequest,
    @Param('id') id: string,
    @Param('paymentId') paymentId: string,
    @Body() body: unknown,
  ) {
    const parsed = reversePaymentSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException('Dados inválidos.');
    }
    return this.sales.reversePayment(
      this.requireTenant(request),
      id,
      paymentId,
      parsed.data,
    );
  }

  private requireTenant(request: AuthedRequest): string {
    const tenantId = request.auth?.user.tenantId;
    if (!tenantId) {
      throw new HttpException('Recurso não encontrado.', HttpStatus.NOT_FOUND);
    }
    return tenantId;
  }
}
