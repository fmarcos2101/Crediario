import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { CollectionService } from './collection.service';

const TICK_MS = 60_000;

@Injectable()
export class CollectionScheduler implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(CollectionScheduler.name);
  private timer: ReturnType<typeof setInterval> | null = null;
  private running = false;

  constructor(private readonly collection: CollectionService) {}

  onModuleInit(): void {
    if (process.env.NODE_ENV === 'test') {
      return;
    }
    this.timer = setInterval(() => {
      void this.tick();
    }, TICK_MS);
  }

  onModuleDestroy(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  private async tick(): Promise<void> {
    if (this.running) {
      return;
    }
    this.running = true;
    try {
      await this.collection.runDue();
    } catch (error) {
      this.logger.error(
        error instanceof Error ? error.message : 'Falha no ciclo de cobrança',
      );
    } finally {
      this.running = false;
    }
  }
}
