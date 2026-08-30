'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch, readApiError } from '@/lib/api';

type Settings = {
  timezone: string;
  locale: string;
  lateInterestEnabled: boolean;
  lateFineEnabled: boolean;
};

export default function AppHomePage() {
  const router = useRouter();
  const [name, setName] = useState<string | null>(null);
  const [settings, setSettings] = useState<Settings | null>(null);
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
      const response = await apiFetch('/tenants/current/settings');
      if (!response.ok) {
        setError(await readApiError(response));
        return;
      }
      setSettings((await response.json()) as Settings);
    })();
  }, [router]);

  async function logout() {
    await apiFetch('/auth/logout', { method: 'POST' });
    router.replace('/login');
  }

  if (error) {
    return (
      <main className="mx-auto max-w-lg px-6 py-16">
        <p className="text-sm text-red-700">{error}</p>
      </main>
    );
  }

  if (!settings || !name) {
    return (
      <main className="mx-auto max-w-lg px-6 py-16">
        <p className="text-sm text-slate-600">Carregando…</p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-2xl px-6 py-16">
      <p className="text-sm font-medium tracking-wide text-teal-800">{name}</p>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight">Painel</h1>
      <p className="mt-3 text-sm text-slate-600">
        Fase 3 — multiempresa. Clientes e vendas vêm na sequência.
      </p>
      <dl className="mt-8 grid gap-4 sm:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <dt className="text-xs uppercase text-slate-500">Fuso</dt>
          <dd className="mt-1 text-sm">{settings.timezone}</dd>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <dt className="text-xs uppercase text-slate-500">Encargos</dt>
          <dd className="mt-1 text-sm">
            {settings.lateInterestEnabled || settings.lateFineEnabled
              ? 'Configurados (sem cálculo automático)'
              : 'Desligados'}
          </dd>
        </div>
      </dl>
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
