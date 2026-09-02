import { API_PREFIX } from '@crediplus/shared';
import { getPublicApiOrigin } from './env';

export type ApiHealth =
  { state: 'ok'; product: string; version: string } | { state: 'down'; reason: string };

export async function fetchApiHealth(): Promise<ApiHealth> {
  const url = `${getPublicApiOrigin()}${API_PREFIX}/health`;

  try {
    const response = await fetch(url, {
      cache: 'no-store',
      headers: { Accept: 'application/json' },
    });

    if (!response.ok) {
      return { state: 'down', reason: `HTTP ${response.status}` };
    }

    const body: unknown = await response.json();
    if (
      typeof body === 'object' &&
      body !== null &&
      'status' in body &&
      body.status === 'ok' &&
      'product' in body &&
      'version' in body &&
      typeof body.product === 'string' &&
      typeof body.version === 'string'
    ) {
      return { state: 'ok', product: body.product, version: body.version };
    }

    return { state: 'down', reason: 'Resposta inválida' };
  } catch {
    return { state: 'down', reason: 'API inacessível' };
  }
}
