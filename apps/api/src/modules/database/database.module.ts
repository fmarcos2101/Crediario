import { Module } from '@nestjs/common';
import { createDb, type Database } from '@crediplus/db';
import type { AppEnv } from '../../config/env';
import { APP_ENV } from '../../config/env.token';
import { EnvModule } from '../../config/env.module';

export const DATABASE = Symbol('DATABASE');

@Module({
  imports: [EnvModule],
  providers: [
    {
      provide: DATABASE,
      inject: [APP_ENV],
      useFactory: (env: AppEnv): Database | null => {
        if (!env.DATABASE_URL) {
          return null;
        }
        return createDb(env.DATABASE_URL).db;
      },
    },
  ],
  exports: [DATABASE],
})
export class DatabaseModule {}
