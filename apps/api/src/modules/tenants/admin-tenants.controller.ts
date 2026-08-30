import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { createTenantSchema } from '@crediplus/shared';
import { CsrfGuard } from '../auth/csrf.guard';
import { SessionGuard } from '../auth/session.guard';
import { SuperAdminGuard } from './tenant.guards';
import { TenantService } from './tenant.service';

@Controller('admin/tenants')
@UseGuards(SessionGuard, SuperAdminGuard)
export class AdminTenantsController {
  constructor(private readonly tenants: TenantService) {}

  @Get()
  list() {
    return this.tenants.listCompanies();
  }

  @Post()
  @UseGuards(CsrfGuard)
  create(@Body() body: unknown) {
    const parsed = createTenantSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException('Dados inválidos.');
    }
    return this.tenants.createCompany(parsed.data.name, parsed.data.ownerEmail);
  }

  @Post(':id/activate')
  @UseGuards(CsrfGuard)
  activate(@Param('id') id: string) {
    return this.tenants.setCompanyStatus(id, 'active');
  }

  @Post(':id/suspend')
  @UseGuards(CsrfGuard)
  suspend(@Param('id') id: string) {
    return this.tenants.setCompanyStatus(id, 'suspended');
  }

  @Post(':id/archive')
  @UseGuards(CsrfGuard)
  archive(@Param('id') id: string) {
    return this.tenants.setCompanyStatus(id, 'archived');
  }
}
