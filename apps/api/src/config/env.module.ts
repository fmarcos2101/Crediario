import { Global, Module } from '@nestjs/common';
import { loadEnv } from './env';
import { APP_ENV } from './env.token';

@Global()
@Module({
  providers: [
    {
      provide: APP_ENV,
      useFactory: () => loadEnv(),
    },
  ],
  exports: [APP_ENV],
})
export class EnvModule {}
