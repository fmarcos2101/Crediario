import { AsyncLocalStorage } from 'node:async_hooks';
import type { RlsContext } from '@crediplus/db';

const storage = new AsyncLocalStorage<RlsContext>();

export function getRlsContext(): RlsContext {
  return (
    storage.getStore() ?? {
      tenantId: null,
      isSuperAdmin: false,
    }
  );
}

export function runWithRls<T>(ctx: RlsContext, fn: () => Promise<T>): Promise<T> {
  return storage.run(ctx, fn);
}
