export function sessionCookieName(secure: boolean): string {
  return secure ? '__Host-crediplus_session' : 'crediplus_session';
}

export function csrfCookieName(secure: boolean): string {
  return secure ? '__Host-crediplus_csrf' : 'crediplus_csrf';
}

export function cookieBaseOptions(env: {
  COOKIE_SECURE: boolean;
  COOKIE_DOMAIN?: string | undefined;
}) {
  return {
    path: '/' as const,
    sameSite: 'lax' as const,
    secure: env.COOKIE_SECURE,
    ...(!env.COOKIE_SECURE && env.COOKIE_DOMAIN && env.COOKIE_DOMAIN.length > 0
      ? { domain: env.COOKIE_DOMAIN }
      : {}),
  };
}
