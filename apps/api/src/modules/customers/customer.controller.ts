import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpException,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  createCustomerSchema,
  listCustomersQuerySchema,
  updateCustomerSchema,
} from '@crediplus/shared';
import { CsrfGuard } from '../auth/csrf.guard';
import { SessionGuard, type AuthedRequest } from '../auth/session.guard';
import { TenantGuard } from '../tenants/tenant.guards';
import { CustomerService } from './customer.service';

@Controller('customers')
@UseGuards(SessionGuard, TenantGuard)
export class CustomerController {
  constructor(private readonly customers: CustomerService) {}

  @Get()
  list(@Req() request: AuthedRequest, @Query() query: Record<string, unknown>) {
    const tenantId = this.requireTenant(request);
    const parsed = listCustomersQuerySchema.safeParse(query);
    if (!parsed.success) {
      throw new BadRequestException('Dados inválidos.');
    }
    return this.customers.list(tenantId, parsed.data);
  }

  @Get(':id')
  get(@Req() request: AuthedRequest, @Param('id') id: string) {
    const tenantId = this.requireTenant(request);
    return this.customers.get(tenantId, id);
  }

  @Post()
  @UseGuards(CsrfGuard)
  create(@Req() request: AuthedRequest, @Body() body: unknown) {
    const tenantId = this.requireTenant(request);
    const parsed = createCustomerSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException('Dados inválidos.');
    }
    return this.customers.create(tenantId, parsed.data);
  }

  @Patch(':id')
  @UseGuards(CsrfGuard)
  update(@Req() request: AuthedRequest, @Param('id') id: string, @Body() body: unknown) {
    const tenantId = this.requireTenant(request);
    const parsed = updateCustomerSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException('Dados inválidos.');
    }
    return this.customers.update(tenantId, id, parsed.data);
  }

  @Post(':id/archive')
  @UseGuards(CsrfGuard)
  archive(@Req() request: AuthedRequest, @Param('id') id: string) {
    const tenantId = this.requireTenant(request);
    return this.customers.archive(tenantId, id);
  }

  private requireTenant(request: AuthedRequest): string {
    const tenantId = request.auth?.user.tenantId;
    if (!tenantId) {
      throw new HttpException('Recurso não encontrado.', HttpStatus.NOT_FOUND);
    }
    return tenantId;
  }
}
