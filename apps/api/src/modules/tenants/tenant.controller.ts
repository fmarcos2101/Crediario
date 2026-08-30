import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpException,
  HttpStatus,
  Param,
  Patch,
  Req,
  UseGuards,
} from '@nestjs/common';
import { updateTenantSettingsSchema } from '@crediplus/shared';
import { CsrfGuard } from '../auth/csrf.guard';
import { SessionGuard, type AuthedRequest } from '../auth/session.guard';
import { TenantGuard } from './tenant.guards';
import { TenantService } from './tenant.service';
import { assertSameTenant } from './tenant-access';

@Controller('tenants')
@UseGuards(SessionGuard, TenantGuard)
export class TenantController {
  constructor(private readonly tenants: TenantService) {}

  @Get('current/settings')
  current(@Req() request: AuthedRequest) {
    const tenantId = request.auth?.user.tenantId;
    if (!tenantId) {
      throw new HttpException('Recurso não encontrado.', HttpStatus.NOT_FOUND);
    }
    return this.tenants.getSettingsForTenant(tenantId);
  }

  @Get(':tenantId/settings')
  byId(@Req() request: AuthedRequest, @Param('tenantId') tenantId: string) {
    const sessionTenant = request.auth?.user.tenantId;
    assertSameTenant(sessionTenant, tenantId);
    return this.tenants.getSettingsForTenant(sessionTenant!);
  }

  @Patch('current/settings')
  @UseGuards(CsrfGuard)
  async update(@Req() request: AuthedRequest, @Body() body: unknown) {
    const tenantId = request.auth?.user.tenantId;
    if (!tenantId) {
      throw new HttpException('Recurso não encontrado.', HttpStatus.NOT_FOUND);
    }
    const parsed = updateTenantSettingsSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException('Dados inválidos.');
    }
    return this.tenants.updateSettingsForTenant(tenantId, parsed.data);
  }
}
