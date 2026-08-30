import { HttpException, HttpStatus } from '@nestjs/common';

export function assertSameTenant(
  sessionTenantId: string | null | undefined,
  requestedTenantId: string,
): void {
  if (!sessionTenantId || sessionTenantId !== requestedTenantId) {
    throw new HttpException('Recurso não encontrado.', HttpStatus.NOT_FOUND);
  }
}
