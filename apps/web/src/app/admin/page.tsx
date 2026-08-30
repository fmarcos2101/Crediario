'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch, readApiError } from '@/lib/api';

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
        setError('Esta área é restrita ao Super Admin.');
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
    <main className="mx-auto max-w-2xl px-6 py-16">
      <p className="text-sm font-medium tracking-wide text-teal-800">Super Admin</p>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight">Painel</h1>
      <p className="mt-3 text-sm text-slate-600">
        Sessão de {email}. Fase 2 — autenticação.
      </p>
      <p className="mt-2 text-sm text-slate-600">
        Empresas, clientes e vendas entram nas próximas fases. Este painel não mostra PII
        de tenant.
      </p>
      <button
        type="button"
        onClick={() => void logout()}
        className="mt-8 rounded-lg border border-slate-300 px-4 py-2 text-sm"
      >
        Sair
      </button>
    </main>
  );
}
