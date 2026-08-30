import { API_PREFIX } from '@crediplus/shared';
import { getPublicApiOrigin } from './env';

function readCookie(name: string): string | null {
  if (typeof document === 'undefined') {
    return null;
  }
  const prefix = `${name}=`;
  const found = document.cookie.split('; ').find((row) => row.startsWith(prefix));
  if (!found) {
    return null;
  }
  return decodeURIComponent(found.slice(prefix.length));
}

export async function apiFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const headers = new Headers(init.headers);
  headers.set('Accept', 'application/json');
  if (init.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  const method = (init.method ?? 'GET').toUpperCase();
  if (method !== 'GET' && method !== 'HEAD') {
    const csrf = readCookie('crediplus_csrf');
    if (csrf) {
      headers.set('X-CSRF-Token', csrf);
    }
  }

  return fetch(`${getPublicApiOrigin()}${API_PREFIX}${path}`, {
    ...init,
    headers,
    credentials: 'include',
    cache: 'no-store',
  });
}

export async function readApiError(response: Response): Promise<string> {
  try {
    const body: unknown = await response.json();
    if (
      typeof body === 'object' &&
      body !== null &&
      'error' in body &&
      typeof body.error === 'object' &&
      body.error !== null &&
      'message' in body.error &&
      typeof body.error.message === 'string'
    ) {
      return body.error.message;
    }
  } catch {
    return 'Falha na comunicação com a API.';
  }
  return 'Falha na comunicação com a API.';
}
