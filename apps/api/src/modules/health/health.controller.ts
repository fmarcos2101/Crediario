import { Controller, Get, HttpException, HttpStatus } from '@nestjs/common';
import { HealthService } from './health.service';

@Controller('health')
export class HealthController {
  constructor(private readonly health: HealthService) {}

  @Get()
  live() {
    return this.health.liveness();
  }

  @Get('ready')
  async ready() {
    const result = await this.health.readiness();
    if (result.status !== 'ok') {
      throw new HttpException(
        {
          message: 'Serviço temporariamente indisponível.',
          checks: result.checks,
        },
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
    return result;
  }
}
