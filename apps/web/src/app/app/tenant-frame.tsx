'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch } from '@/lib/api';
import { AppNav } from './app-nav';

export function useTenantSession() {
  const router = useRouter();
  const [name, setName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      const me = await apiFetch('/auth/me');
      if (me.status === 401) {
        router.replace('/login');
        return;
      }
      const body = (await me.json()) as {
        user?: { tenantName?: string | null; isSuperAdmin?: boolean };
      };
      if (body.user?.isSuperAdmin) {
        router.replace('/admin');
        return;
      }
      setName(body.user?.tenantName ?? 'Empresa');
    })();
  }, [router]);

  const logout = useCallback(async () => {
    await apiFetch('/auth/logout', { method: 'POST' });
    router.replace('/login');
  }, [router]);

  return { name, error, setError, logout };
}

export function TenantFrame({
  children,
}: {
  children: (ctx: {
    name: string;
    setError: (value: string | null) => void;
  }) => React.ReactNode;
}) {
  const { name, error, setError, logout } = useTenantSession();

  if (!name) {
    return (
      <main className="mx-auto max-w-lg px-6 py-16">
        <p className="text-sm text-slate-600">Carregando…</p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      <AppNav name={name} onLogout={() => void logout()} />
      {error ? <p className="mb-4 text-sm text-red-700">{error}</p> : null}
      {children({ name, setError })}
    </main>
  );
}
