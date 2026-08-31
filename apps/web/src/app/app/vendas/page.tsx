'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { buildInstallmentPlan } from '@crediplus/shared';
import { apiFetch, readApiError } from '@/lib/api';
import { TenantFrame } from '../tenant-frame';

type Customer = { id: string; name: string };
type SaleRow = {
  id: string;
  customerName: string;
  status: 'open' | 'cancelled';
  settled: boolean;
  totalAmount: string;
  installmentCount: number;
  createdAt: string;
};

function brl(value: string): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(
    Number(value),
  );
}

export default function VendasPage() {
  return (
    <TenantFrame>{({ setError }) => <VendasPanel setError={setError} />}</TenantFrame>
  );
}

function VendasPanel({ setError }: { setError: (value: string | null) => void }) {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [sales, setSales] = useState<SaleRow[] | null>(null);
  const [customerId, setCustomerId] = useState('');
  const [description, setDescription] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [unitPrice, setUnitPrice] = useState('');
  const [items, setItems] = useState<
    { description: string; quantity: number; unitPrice: string }[]
  >([]);
  const [downPayment, setDownPayment] = useState('0');
  const [installmentCount, setInstallmentCount] = useState(3);
  const [firstDueDate, setFirstDueDate] = useState('');
  const [pending, setPending] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  async function load() {
    const [customerRes, saleRes] = await Promise.all([
      apiFetch('/customers?status=active'),
      apiFetch('/sales'),
    ]);
    if (!customerRes.ok) {
      setError(await readApiError(customerRes));
      return;
    }
    if (!saleRes.ok) {
      setError(await readApiError(saleRes));
      return;
    }
    const customerRows = (await customerRes.json()) as Customer[];
    setCustomers(customerRows);
    if (!customerId && customerRows[0]) {
      setCustomerId(customerRows[0].id);
    }
    setSales((await saleRes.json()) as SaleRow[]);
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const preview = useMemo(() => {
    const total = items.reduce(
      (acc, item) => acc + Number(item.unitPrice) * item.quantity,
      0,
    );
    const down = Number(downPayment || '0');
    const financed = total - down;
    if (!firstDueDate || items.length === 0 || financed <= 0 || installmentCount < 1) {
      return [];
    }
    return buildInstallmentPlan({
      financed: financed.toFixed(2),
      count: installmentCount,
      firstDueDate,
      frequency: 'monthly',
    });
  }, [items, downPayment, installmentCount, firstDueDate]);

  function addItem(event: React.FormEvent) {
    event.preventDefault();
    if (!description.trim() || !unitPrice) {
      return;
    }
    setItems((current) => [
      ...current,
      { description: description.trim(), quantity, unitPrice },
    ]);
    setDescription('');
    setQuantity(1);
    setUnitPrice('');
  }

  async function create(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);
    setNotice(null);
    try {
      const response = await apiFetch('/sales', {
        method: 'POST',
        body: JSON.stringify({
          customerId,
          items,
          downPayment: downPayment || '0',
          installmentCount,
          frequency: 'monthly',
          firstDueDate,
        }),
      });
      if (!response.ok) {
        setError(await readApiError(response));
        return;
      }
      setItems([]);
      setDownPayment('0');
      setNotice('Venda criada.');
      await load();
    } finally {
      setPending(false);
    }
  }

  return (
    <div>
      <h1 className="text-3xl font-semibold tracking-tight">Vendas</h1>
      <p className="mt-2 text-sm text-slate-600">
        Parcelas mensuais pelo valor de face. A última absorve os centavos. Encargos não
        entram no cálculo.
      </p>

      <form onSubmit={(event) => void create(event)} className="mt-8 space-y-4">
        <label className="block text-sm">
          <span className="text-slate-600">Cliente</span>
          <select
            value={customerId}
            onChange={(event) => setCustomerId(event.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2"
            required
          >
            {customers.length === 0 ? (
              <option value="">Cadastre um cliente</option>
            ) : null}
            {customers.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        </label>

        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-sm font-medium">Itens</p>
          <div className="mt-3 grid gap-3 sm:grid-cols-4">
            <input
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="Descrição"
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm sm:col-span-2"
            />
            <input
              type="number"
              min={1}
              value={quantity}
              onChange={(event) => setQuantity(Number(event.target.value))}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
            <input
              value={unitPrice}
              onChange={(event) => setUnitPrice(event.target.value)}
              placeholder="Preço 199.90"
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
          <button
            type="button"
            onClick={(event) => addItem(event)}
            className="mt-3 rounded-lg border border-slate-300 px-3 py-1.5 text-xs"
          >
            Adicionar item
          </button>
          <ul className="mt-3 space-y-1 text-sm">
            {items.map((item, index) => (
              <li
                key={`${item.description}-${index}`}
                className="flex justify-between gap-2"
              >
                <span>
                  {item.quantity}× {item.description}
                </span>
                <span>{brl((Number(item.unitPrice) * item.quantity).toFixed(2))}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <label className="block text-sm">
            <span className="text-slate-600">Entrada</span>
            <input
              value={downPayment}
              onChange={(event) => setDownPayment(event.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
            />
          </label>
          <label className="block text-sm">
            <span className="text-slate-600">Parcelas</span>
            <input
              type="number"
              min={1}
              max={60}
              value={installmentCount}
              onChange={(event) => setInstallmentCount(Number(event.target.value))}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
              required
            />
          </label>
          <label className="block text-sm">
            <span className="text-slate-600">1º vencimento</span>
            <input
              type="date"
              value={firstDueDate}
              onChange={(event) => setFirstDueDate(event.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
              required
            />
          </label>
        </div>

        {preview.length > 0 ? (
          <p className="text-sm text-slate-600">
            Preview:{' '}
            {preview.map((item) => `${item.sequence}ª ${brl(item.amount)}`).join(' · ')}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={pending || items.length === 0 || !customerId}
          className="rounded-lg bg-teal-800 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
        >
          {pending ? 'Salvando…' : 'Registrar venda'}
        </button>
      </form>

      {notice ? <p className="mt-4 text-sm text-teal-800">{notice}</p> : null}

      <ul className="mt-8 space-y-3">
        {(sales ?? []).map((item) => (
          <li key={item.id}>
            <Link
              href={`/app/vendas/${item.id}`}
              className="block rounded-xl border border-slate-200 bg-white p-4"
            >
              <p className="font-medium">{item.customerName}</p>
              <p className="mt-1 text-sm text-slate-600">
                {brl(item.totalAmount)} · {item.installmentCount}x ·{' '}
                {item.status === 'cancelled'
                  ? 'Cancelada'
                  : item.settled
                    ? 'Quitada'
                    : 'Em aberto'}
              </p>
            </Link>
          </li>
        ))}
      </ul>
      {sales?.length === 0 ? (
        <p className="mt-4 text-sm text-slate-600">Nenhuma venda ainda.</p>
      ) : null}
    </div>
  );
}
