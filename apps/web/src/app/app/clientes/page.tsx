'use client';

import { useEffect, useState } from 'react';
import { apiFetch, readApiError } from '@/lib/api';
import { TenantFrame } from '../tenant-frame';

type Customer = {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  cpfMasked: string;
  cpf: string | null;
  notes: string | null;
  status: 'active' | 'archived';
};

export default function ClientesPage() {
  return (
    <TenantFrame>{({ setError }) => <ClientesPanel setError={setError} />}</TenantFrame>
  );
}

function ClientesPanel({ setError }: { setError: (value: string | null) => void }) {
  const [items, setItems] = useState<Customer[] | null>(null);
  const [q, setQ] = useState('');
  const [name, setName] = useState('');
  const [cpf, setCpf] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [pending, setPending] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [editing, setEditing] = useState<Customer | null>(null);

  async function load(search = q) {
    const params = new URLSearchParams({ status: 'active' });
    if (search.trim()) {
      params.set('q', search.trim());
    }
    const response = await apiFetch(`/customers?${params.toString()}`);
    if (!response.ok) {
      setError(await readApiError(response));
      return;
    }
    setItems((await response.json()) as Customer[]);
  }

  useEffect(() => {
    void load('');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function create(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    setNotice(null);
    setError(null);
    try {
      const response = await apiFetch('/customers', {
        method: 'POST',
        body: JSON.stringify({
          name,
          cpf,
          phone: phone || undefined,
          email: email || undefined,
        }),
      });
      if (!response.ok) {
        setError(await readApiError(response));
        return;
      }
      setName('');
      setCpf('');
      setPhone('');
      setEmail('');
      setNotice('Cliente cadastrado.');
      await load('');
    } finally {
      setPending(false);
    }
  }

  async function startEdit(id: string) {
    setError(null);
    const response = await apiFetch(`/customers/${id}`);
    if (!response.ok) {
      setError(await readApiError(response));
      return;
    }
    setEditing((await response.json()) as Customer);
  }

  async function saveEdit(event: React.FormEvent) {
    event.preventDefault();
    if (!editing) {
      return;
    }
    setPending(true);
    setError(null);
    setNotice(null);
    try {
      const response = await apiFetch(`/customers/${editing.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          name: editing.name,
          cpf: editing.cpf || undefined,
          phone: editing.phone,
          email: editing.email,
          notes: editing.notes,
        }),
      });
      if (!response.ok) {
        setError(await readApiError(response));
        return;
      }
      setEditing(null);
      setNotice('Cliente atualizado.');
      await load();
    } finally {
      setPending(false);
    }
  }

  async function archive(id: string) {
    setError(null);
    const response = await apiFetch(`/customers/${id}/archive`, { method: 'POST' });
    if (!response.ok) {
      setError(await readApiError(response));
      return;
    }
    if (editing?.id === id) {
      setEditing(null);
    }
    await load();
  }

  return (
    <div>
      <h1 className="text-3xl font-semibold tracking-tight">Clientes</h1>
      <p className="mt-2 text-sm text-slate-600">
        Sem RG e sem data de nascimento. CPF fica cifrado; a busca usa HMAC.
      </p>

      <form onSubmit={(event) => void create(event)} className="mt-8 space-y-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-sm">
            <span className="text-slate-600">Nome</span>
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
              required
              minLength={2}
            />
          </label>
          <label className="block text-sm">
            <span className="text-slate-600">CPF</span>
            <input
              value={cpf}
              onChange={(event) => setCpf(event.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
              required
            />
          </label>
          <label className="block text-sm">
            <span className="text-slate-600">Telefone</span>
            <input
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
            />
          </label>
          <label className="block text-sm">
            <span className="text-slate-600">E-mail</span>
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
            />
          </label>
        </div>
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-teal-800 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
        >
          {pending ? 'Salvando…' : 'Cadastrar'}
        </button>
      </form>

      <form
        className="mt-8 flex gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          void load(q);
        }}
      >
        <input
          value={q}
          onChange={(event) => setQ(event.target.value)}
          placeholder="Buscar nome ou CPF"
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
        />
        <button
          type="submit"
          className="rounded-lg border border-slate-300 px-4 py-2 text-sm"
        >
          Buscar
        </button>
      </form>

      {notice ? <p className="mt-4 text-sm text-teal-800">{notice}</p> : null}

      {editing ? (
        <form
          onSubmit={(event) => void saveEdit(event)}
          className="mt-6 space-y-3 rounded-xl border border-teal-200 bg-white p-4"
        >
          <p className="text-sm font-medium">Editar cliente</p>
          <label className="block text-sm">
            <span className="text-slate-600">Nome</span>
            <input
              value={editing.name}
              onChange={(event) => setEditing({ ...editing, name: event.target.value })}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
              required
            />
          </label>
          <label className="block text-sm">
            <span className="text-slate-600">CPF</span>
            <input
              value={editing.cpf ?? ''}
              onChange={(event) => setEditing({ ...editing, cpf: event.target.value })}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
              required
            />
          </label>
          <label className="block text-sm">
            <span className="text-slate-600">Telefone</span>
            <input
              value={editing.phone ?? ''}
              onChange={(event) =>
                setEditing({ ...editing, phone: event.target.value || null })
              }
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
            />
          </label>
          <label className="block text-sm">
            <span className="text-slate-600">E-mail</span>
            <input
              type="email"
              value={editing.email ?? ''}
              onChange={(event) =>
                setEditing({ ...editing, email: event.target.value || null })
              }
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
            />
          </label>
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={pending}
              className="rounded-lg bg-teal-800 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
            >
              {pending ? 'Salvando…' : 'Salvar alterações'}
            </button>
            <button
              type="button"
              onClick={() => setEditing(null)}
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm"
            >
              Cancelar
            </button>
          </div>
        </form>
      ) : null}

      <ul className="mt-6 space-y-3">
        {(items ?? []).map((item) => (
          <li key={item.id} className="rounded-xl border border-slate-200 bg-white p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="font-medium">{item.name}</p>
                <p className="mt-1 text-sm text-slate-600">
                  CPF {item.cpfMasked}
                  {item.phone ? ` · ${item.phone}` : ''}
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => void startEdit(item.id)}
                  className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs"
                >
                  Editar
                </button>
                <button
                  type="button"
                  onClick={() => void archive(item.id)}
                  className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs"
                >
                  Arquivar
                </button>
              </div>
            </div>
          </li>
        ))}
      </ul>
      {items?.length === 0 ? (
        <p className="mt-4 text-sm text-slate-600">Nenhum cliente ainda.</p>
      ) : null}
    </div>
  );
}
