'use client';

import Link from 'next/link';
import { TenantFrame } from './tenant-frame';

export default function AppHomePage() {
  return (
    <TenantFrame>
      {() => (
        <>
          <h1 className="text-3xl font-semibold tracking-tight">Painel</h1>
          <p className="mt-3 text-sm text-slate-600">
            Cadastre clientes, registre vendas e processe a cobrança pelo painel.
          </p>
          <dl className="mt-8 grid gap-4 sm:grid-cols-2">
            <Link
              href="/app/clientes"
              className="rounded-xl border border-slate-200 bg-white p-4"
            >
              <dt className="text-xs uppercase text-slate-500">Clientes</dt>
              <dd className="mt-1 text-sm">Cadastro com CPF cifrado</dd>
            </Link>
            <Link
              href="/app/vendas"
              className="rounded-xl border border-slate-200 bg-white p-4"
            >
              <dt className="text-xs uppercase text-slate-500">Vendas</dt>
              <dd className="mt-1 text-sm">Crediário e parcelas</dd>
            </Link>
            <Link
              href="/app/cobranca"
              className="rounded-xl border border-slate-200 bg-white p-4"
            >
              <dt className="text-xs uppercase text-slate-500">Cobrança</dt>
              <dd className="mt-1 text-sm">Lembretes, atraso e webhook</dd>
            </Link>
            <Link
              href="/app/configuracoes"
              className="rounded-xl border border-slate-200 bg-white p-4"
            >
              <dt className="text-xs uppercase text-slate-500">Configurações</dt>
              <dd className="mt-1 text-sm">Prazos, mensagens, pagamento e Meta</dd>
            </Link>
          </dl>
        </>
      )}
    </TenantFrame>
  );
}
