import { Module } from '@nestjs/common';
import type { Database } from '@crediplus/db';
import type { AppEnv } from '../../config/env';
import { APP_ENV } from '../../config/env.token';
import { ConsoleEmailProvider } from '../email/email.provider';
import { DATABASE, DatabaseModule } from '../database/database.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { CsrfGuard } from './csrf.guard';
import { DrizzleAuthRepository } from './drizzle-auth.repository';
import { MemoryAuthRepository } from './memory-auth.repository';
import { SessionGuard } from './session.guard';

@Module({
  imports: [DatabaseModule],
  controllers: [AuthController],
  providers: [
    {
      provide: AuthService,
      inject: [APP_ENV, DATABASE],
      useFactory: (env: AppEnv, db: Database | null) => {
        if (!db && env.NODE_ENV === 'production') {
          throw new Error('DATABASE_URL é obrigatória em produção.');
        }
        const repo = db ? new DrizzleAuthRepository(db) : new MemoryAuthRepository();
        return new AuthService(repo, env, new ConsoleEmailProvider());
      },
    },
    SessionGuard,
    CsrfGuard,
  ],
  exports: [AuthService],
})
export class AuthModule {}
