'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { apiFetch, readApiError } from '@/lib/api';
import { TenantFrame } from '../tenant-frame';

type CollectionMessage = {
  id: string;
  saleId: string;
  installmentId: string;
  kind: string;
  channel: string;
  status: string;
  body: string;
  recipient: string | null;
  createdAt: string;
};

const KINDS: Record<string, string> = {
  due_reminder: 'Lembrete de vencimento',
  overdue: 'Atraso',
  protest_warning: 'Aviso de protesto',
  payment_received: 'Pagamento recebido',
};

const STATUSES: Record<string, string> = {
  sent: 'Enviada',
  skipped_no_channel: 'Sem canal',
  skipped_disabled: 'Desligada',
};

export default function CobrancaPage() {
  return (
    <TenantFrame>{({ setError }) => <CobrancaPanel setError={setError} />}</TenantFrame>
  );
}

function CobrancaPanel({ setError }: { setError: (value: string | null) => void }) {
  const [items, setItems] = useState<CollectionMessage[] | null>(null);
  const [pending, setPending] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  async function load() {
    const response = await apiFetch('/collection/messages');
    if (!response.ok) {
      setError(await readApiError(response));
      return;
    }
    setItems((await response.json()) as CollectionMessage[]);
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function run() {
    setPending(true);
    setError(null);
    setNotice(null);
    try {
      const response = await apiFetch('/collection/run', { method: 'POST' });
      if (!response.ok) {
        setError(await readApiError(response));
        return;
      }
      const body = (await response.json()) as { created: number };
      setNotice(
        body.created === 0
          ? 'Nenhuma mensagem nova neste ciclo.'
          : `${body.created} mensagem(ns) processada(s).`,
      );
      await load();
    } finally {
      setPending(false);
    }
  }

  return (
    <div>
      <h1 className="text-3xl font-semibold tracking-tight">Cobrança</h1>
      <p className="mt-3 text-sm text-slate-600">
        Lembretes, atraso e aviso de protesto usam os prazos e textos de Configurações.
        WhatsApp ainda não é enviado. O ciclo automático roda no servidor a cada minuto.
      </p>
      <div className="mt-6 flex flex-wrap gap-3">
        <button
          type="button"
          onClick={() => void run()}
          disabled={pending}
          className="rounded-lg bg-teal-800 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
        >
          {pending ? 'Processando…' : 'Processar cobranças'}
        </button>
        <Link
          href="/app/configuracoes"
          className="rounded-lg border border-slate-300 px-4 py-2 text-sm"
        >
          Textos e prazos
        </Link>
      </div>
      {notice ? <p className="mt-4 text-sm text-teal-800">{notice}</p> : null}

      {items === null ? (
        <p className="mt-8 text-sm text-slate-600">Carregando mensagens…</p>
      ) : items.length === 0 ? (
        <p className="mt-8 text-sm text-slate-600">Nenhuma mensagem ainda.</p>
      ) : (
        <ul className="mt-8 space-y-3">
          {items.map((item) => (
            <li
              key={item.id}
              className="rounded-xl border border-slate-200 bg-white p-4 text-sm"
            >
              <p className="font-medium">
                {KINDS[item.kind] ?? item.kind} · {STATUSES[item.status] ?? item.status}
              </p>
              <p className="mt-1 text-slate-600">{item.body}</p>
              <p className="mt-2 text-xs text-slate-500">
                {item.channel === 'email' ? `E-mail · ${item.recipient}` : 'Sem envio'} ·{' '}
                <Link
                  href={`/app/vendas/${item.saleId}`}
                  className="text-teal-800 underline"
                >
                  Ver venda
                </Link>
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
