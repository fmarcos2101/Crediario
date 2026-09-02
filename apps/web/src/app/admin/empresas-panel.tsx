'use client';

import { useEffect, useState } from 'react';
import { apiFetch, readApiError } from '@/lib/api';

type TenantStatus =
  'pending_setup' | 'pending_activation' | 'active' | 'suspended' | 'archived';

type Company = {
  id: string;
  name: string;
  status: TenantStatus;
  ownerEmail: string | null;
  createdAt: string;
  lastAccessAt: string | null;
  customerCount: number;
  saleCount: number;
  paymentConfigured: boolean;
  metaConfigured: boolean;
};

const STATUS_LABEL: Record<TenantStatus, string> = {
  pending_setup: 'Aguardando senha',
  pending_activation: 'Aguardando liberação',
  active: 'Ativa',
  suspended: 'Suspensa',
  archived: 'Arquivada',
};

export function EmpresasPanel() {
  const [companies, setCompanies] = useState<Company[] | null>(null);
  const [name, setName] = useState('');
  const [ownerEmail, setOwnerEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function load() {
    const response = await apiFetch('/admin/tenants');
    if (!response.ok) {
      setError(await readApiError(response));
      return;
    }
    setCompanies((await response.json()) as Company[]);
  }

  useEffect(() => {
    void load();
  }, []);

  async function create(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);
    setNotice(null);
    try {
      const response = await apiFetch('/admin/tenants', {
        method: 'POST',
        body: JSON.stringify({ name, ownerEmail }),
      });
      if (!response.ok) {
        setError(await readApiError(response));
        return;
      }
      const body = (await response.json()) as { inviteSentTo?: string };
      setName('');
      setOwnerEmail('');
      setNotice(`Convite enviado para ${body.inviteSentTo ?? ownerEmail}.`);
      await load();
    } catch {
      setError('Não foi possível criar a empresa.');
    } finally {
      setPending(false);
    }
  }

  async function act(id: string, action: 'activate' | 'suspend' | 'archive') {
    setError(null);
    setNotice(null);
    const response = await apiFetch(`/admin/tenants/${id}/${action}`, {
      method: 'POST',
    });
    if (!response.ok) {
      setError(await readApiError(response));
      return;
    }
    await load();
  }

  if (!companies && !error) {
    return <p className="text-sm text-slate-600">Carregando empresas…</p>;
  }

  return (
    <section className="mt-10">
      <h2 className="text-lg font-semibold">Empresas</h2>
      <p className="mt-1 text-sm text-slate-600">
        Só metadados da empresa. Sem clientes, vendas ou documentos.
      </p>

      <form onSubmit={(event) => void create(event)} className="mt-6 space-y-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-sm">
            <span className="text-slate-600">Nome</span>
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2"
              minLength={2}
              required
            />
          </label>
          <label className="block text-sm">
            <span className="text-slate-600">E-mail do dono</span>
            <input
              type="email"
              value={ownerEmail}
              onChange={(event) => setOwnerEmail(event.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2"
              required
            />
          </label>
        </div>
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-teal-800 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
        >
          {pending ? 'Criando…' : 'Criar e convidar'}
        </button>
      </form>

      {notice ? <p className="mt-4 text-sm text-teal-800">{notice}</p> : null}
      {error ? <p className="mt-4 text-sm text-red-700">{error}</p> : null}

      <ul className="mt-8 space-y-3">
        {(companies ?? []).map((company) => (
          <li
            key={company.id}
            className="rounded-xl border border-slate-200 bg-white p-4"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="font-medium">{company.name}</p>
                <p className="mt-1 text-sm text-slate-600">
                  {company.ownerEmail ?? 'Convite ainda sem usuário'} ·{' '}
                  {STATUS_LABEL[company.status]}
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  {company.customerCount} cliente(s) · {company.saleCount} venda(s) ·
                  Pagamento {company.paymentConfigured ? 'configurado' : 'não'} · Meta{' '}
                  {company.metaConfigured ? 'configurada' : 'não'}
                  {company.lastAccessAt
                    ? ` · Último acesso ${new Date(company.lastAccessAt).toLocaleString('pt-BR')}`
                    : ''}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {company.status === 'pending_activation' ||
                company.status === 'suspended' ? (
                  <button
                    type="button"
                    onClick={() => void act(company.id, 'activate')}
                    className="rounded-lg bg-teal-800 px-3 py-1.5 text-xs font-medium text-white"
                  >
                    Liberar
                  </button>
                ) : null}
                {company.status === 'active' ? (
                  <button
                    type="button"
                    onClick={() => void act(company.id, 'suspend')}
                    className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs"
                  >
                    Suspender
                  </button>
                ) : null}
                {company.status !== 'archived' ? (
                  <button
                    type="button"
                    onClick={() => void act(company.id, 'archive')}
                    className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs"
                  >
                    Arquivar
                  </button>
                ) : null}
              </div>
            </div>
          </li>
        ))}
      </ul>
      {companies?.length === 0 ? (
        <p className="mt-4 text-sm text-slate-600">Nenhuma empresa ainda.</p>
      ) : null}
    </section>
  );
}
