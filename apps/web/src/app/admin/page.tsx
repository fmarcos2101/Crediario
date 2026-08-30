'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch, readApiError } from '@/lib/api';
import { EmpresasPanel } from './empresas-panel';

type Me = { user?: { email: string; isSuperAdmin: boolean } };

export default function AdminPage() {
  const router = useRouter();
  const [email, setEmail] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      const response = await apiFetch('/auth/me');
      if (response.status === 401) {
        router.replace('/login');
        return;
      }
      if (!response.ok) {
        setError(await readApiError(response));
        return;
      }
      const body = (await response.json()) as Me;
      if (!body.user?.isSuperAdmin) {
        router.replace('/app');
        return;
      }
      setEmail(body.user.email);
    })();
  }, [router]);

  async function logout() {
    const response = await apiFetch('/auth/logout', { method: 'POST' });
    if (!response.ok && response.status !== 401) {
      setError(await readApiError(response));
      return;
    }
    router.replace('/login');
  }

  if (error) {
    return (
      <main className="mx-auto max-w-lg px-6 py-16">
        <p className="text-sm text-red-700">{error}</p>
      </main>
    );
  }

  if (!email) {
    return (
      <main className="mx-auto max-w-lg px-6 py-16">
        <p className="text-sm text-slate-600">Carregando…</p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium tracking-wide text-teal-800">Super Admin</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">Painel</h1>
          <p className="mt-3 text-sm text-slate-600">Sessão de {email}.</p>
        </div>
        <button
          type="button"
          onClick={() => void logout()}
          className="rounded-lg border border-slate-300 px-4 py-2 text-sm"
        >
          Sair
        </button>
      </div>
      <EmpresasPanel />
    </main>
  );
}
