'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { apiFetch, readApiError } from '@/lib/api';
import { TenantFrame } from '../../tenant-frame';

type Sale = {
  id: string;
  customerName: string;
  status: 'open' | 'cancelled';
  settled: boolean;
  totalAmount: string;
  downPayment: string;
  financedAmount: string;
  notes: string | null;
  items: { id: string; description: string; quantity: number; lineTotal: string }[];
  installments: {
    id: string;
    sequence: number;
    dueDate: string;
    amount: string;
    paidAmount: string;
    remaining: string;
    status: string;
    late: boolean;
  }[];
  payments: {
    id: string;
    installmentId: string;
    amount: string;
    reversedAmount: string;
    netAmount: string;
    method: string;
    paidAt: string;
  }[];
};

const STATUS: Record<string, string> = {
  OPEN: 'Aberta',
  DUE_SOON: 'A vencer',
  OVERDUE: 'Atrasada',
  PARTIALLY_PAID: 'Parcial',
  PAID: 'Paga',
  CANCELLED: 'Cancelada',
  RENEGOTIATED: 'Renegociada',
};

const METHODS = [
  { value: 'PIX', label: 'Pix' },
  { value: 'CASH', label: 'Dinheiro' },
  { value: 'CARD', label: 'Cartão' },
  { value: 'TRANSFER', label: 'Transferência' },
  { value: 'BOLETO', label: 'Boleto' },
  { value: 'OTHER', label: 'Outro' },
];

function pickOpenInstallment(sale: Sale): {
  installmentId: string;
  amount: string;
} {
  const open = sale.installments.find(
    (item) => item.status !== 'PAID' && item.status !== 'CANCELLED',
  );
  return {
    installmentId: open?.id ?? '',
    amount: open?.remaining ?? '',
  };
}

function brl(value: string): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(
    Number(value),
  );
}

export default function VendaDetalhePage() {
  return <TenantFrame>{({ setError }) => <Detalhe setError={setError} />}</TenantFrame>;
}

function Detalhe({ setError }: { setError: (value: string | null) => void }) {
  const params = useParams<{ id: string }>();
  const [sale, setSale] = useState<Sale | null>(null);
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState('PIX');
  const [installmentId, setInstallmentId] = useState('');
  const [reason, setReason] = useState('Estorno');
  const [pending, setPending] = useState(false);

  async function load() {
    const response = await apiFetch(`/sales/${params.id}`);
    if (!response.ok) {
      setError(await readApiError(response));
      return;
    }
    const body = (await response.json()) as Sale;
    setSale(body);
    const next = pickOpenInstallment(body);
    setInstallmentId(next.installmentId);
    setAmount(next.amount);
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.id]);

  async function pay(event: React.FormEvent) {
    event.preventDefault();
    if (!sale) {
      return;
    }
    setPending(true);
    setError(null);
    try {
      const response = await apiFetch(`/sales/${sale.id}/payments`, {
        method: 'POST',
        body: JSON.stringify({ installmentId, amount, method }),
      });
      if (!response.ok) {
        setError(await readApiError(response));
        return;
      }
      const paid = (await response.json()) as Sale;
      setSale(paid);
      const next = pickOpenInstallment(paid);
      setInstallmentId(next.installmentId);
      setAmount(next.amount);
    } finally {
      setPending(false);
    }
  }

  async function reverse(paymentId: string) {
    if (!sale) {
      return;
    }
    setPending(true);
    setError(null);
    try {
      const response = await apiFetch(`/sales/${sale.id}/payments/${paymentId}/reverse`, {
        method: 'POST',
        body: JSON.stringify({ reason }),
      });
      if (!response.ok) {
        setError(await readApiError(response));
        return;
      }
      const reversed = (await response.json()) as Sale;
      setSale(reversed);
      const next = pickOpenInstallment(reversed);
      setInstallmentId(next.installmentId);
      setAmount(next.amount);
    } finally {
      setPending(false);
    }
  }

  async function cancel() {
    if (!sale) {
      return;
    }
    setPending(true);
    setError(null);
    try {
      const response = await apiFetch(`/sales/${sale.id}/cancel`, { method: 'POST' });
      if (!response.ok) {
        setError(await readApiError(response));
        return;
      }
      await load();
    } finally {
      setPending(false);
    }
  }

  if (!sale) {
    return <p className="text-sm text-slate-600">Carregando venda…</p>;
  }

  const canPay = sale.status === 'open' && !sale.settled;

  return (
    <div>
      <p className="text-sm">
        <Link href="/app/vendas" className="text-teal-800 underline">
          Vendas
        </Link>
      </p>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight">{sale.customerName}</h1>
      <p className="mt-2 text-sm text-slate-600">
        {brl(sale.totalAmount)} · entrada {brl(sale.downPayment)} · financiado{' '}
        {brl(sale.financedAmount)} ·{' '}
        {sale.status === 'cancelled'
          ? 'Cancelada'
          : sale.settled
            ? 'Quitada'
            : 'Em aberto'}
      </p>

      <ul className="mt-6 space-y-1 text-sm">
        {sale.items.map((item) => (
          <li key={item.id}>
            {item.quantity}× {item.description} · {brl(item.lineTotal)}
          </li>
        ))}
      </ul>

      <h2 className="mt-8 text-lg font-semibold">Parcelas</h2>
      <ul className="mt-3 space-y-2">
        {sale.installments.map((item) => (
          <li
            key={item.id}
            className="rounded-xl border border-slate-200 bg-white p-3 text-sm"
          >
            {item.sequence}ª · {item.dueDate} · {brl(item.amount)} · saldo{' '}
            {brl(item.remaining)} · {STATUS[item.status] ?? item.status}
            {item.late ? ' · em atraso' : ''}
          </li>
        ))}
      </ul>

      {canPay ? (
        <form onSubmit={(event) => void pay(event)} className="mt-8 space-y-3">
          <h2 className="text-lg font-semibold">Registrar pagamento</h2>
          <label className="block text-sm">
            <span className="text-slate-600">Parcela</span>
            <select
              value={installmentId}
              onChange={(event) => {
                setInstallmentId(event.target.value);
                const found = sale.installments.find(
                  (item) => item.id === event.target.value,
                );
                if (found) {
                  setAmount(found.remaining);
                }
              }}
              className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2"
            >
              {sale.installments
                .filter((item) => item.status !== 'PAID' && item.status !== 'CANCELLED')
                .map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.sequence}ª · saldo {brl(item.remaining)}
                  </option>
                ))}
            </select>
          </label>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-sm">
              <span className="text-slate-600">Valor</span>
              <input
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
                required
              />
            </label>
            <label className="block text-sm">
              <span className="text-slate-600">Meio</span>
              <select
                value={method}
                onChange={(event) => setMethod(event.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2"
              >
                {METHODS.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <button
            type="submit"
            disabled={pending}
            className="rounded-lg bg-teal-800 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
          >
            {pending ? 'Salvando…' : 'Baixar parcela'}
          </button>
        </form>
      ) : null}

      {sale.payments.length > 0 ? (
        <div className="mt-8">
          <h2 className="text-lg font-semibold">Pagamentos</h2>
          <ul className="mt-3 space-y-2">
            {sale.payments.map((item) => (
              <li
                key={item.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white p-3 text-sm"
              >
                <span>
                  {brl(item.netAmount)} · {item.method}
                  {item.reversedAmount !== '0.00' ? ' · estornado em parte' : ''}
                </span>
                {sale.status === 'open' && item.netAmount !== '0.00' ? (
                  <button
                    type="button"
                    onClick={() => void reverse(item.id)}
                    className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs"
                  >
                    Estornar
                  </button>
                ) : null}
              </li>
            ))}
          </ul>
          {sale.status === 'open' ? (
            <label className="mt-3 block text-sm">
              <span className="text-slate-600">Motivo do estorno</span>
              <input
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
              />
            </label>
          ) : null}
        </div>
      ) : null}

      {sale.status === 'open' &&
      sale.payments.every((item) => item.netAmount === '0.00') ? (
        <button
          type="button"
          onClick={() => void cancel()}
          disabled={pending}
          className="mt-8 rounded-lg border border-slate-300 px-4 py-2 text-sm"
        >
          Cancelar venda
        </button>
      ) : null}
    </div>
  );
}
