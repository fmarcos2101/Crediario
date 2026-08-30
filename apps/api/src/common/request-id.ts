import { randomUUID } from 'node:crypto';
import type { IncomingHttpHeaders } from 'node:http';

const REQUEST_ID_HEADER = 'x-request-id';

export function resolveRequestId(headers: IncomingHttpHeaders): string {
  const incoming = headers[REQUEST_ID_HEADER];
  if (typeof incoming === 'string' && incoming.trim().length >= 8) {
    return incoming.trim();
  }
  return randomUUID();
}
