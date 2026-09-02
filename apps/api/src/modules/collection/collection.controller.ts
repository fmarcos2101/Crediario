import {
  Controller,
  Get,
  HttpException,
  HttpStatus,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { CsrfGuard } from '../auth/csrf.guard';
import { SessionGuard, type AuthedRequest } from '../auth/session.guard';
import { TenantGuard } from '../tenants/tenant.guards';
import { CollectionService } from './collection.service';

@Controller('collection')
@UseGuards(SessionGuard, TenantGuard)
export class CollectionController {
  constructor(private readonly collection: CollectionService) {}

  @Get('messages')
  list(@Req() request: AuthedRequest, @Query('saleId') saleId?: string) {
    return this.collection.listMessages(this.requireTenant(request), saleId);
  }

  @Post('run')
  @UseGuards(CsrfGuard)
  run(@Req() request: AuthedRequest) {
    return this.collection.runTenantLimited(this.requireTenant(request));
  }

  private requireTenant(request: AuthedRequest): string {
    const tenantId = request.auth?.user.tenantId;
    if (!tenantId) {
      throw new HttpException('Recurso não encontrado.', HttpStatus.NOT_FOUND);
    }
    return tenantId;
  }
}
