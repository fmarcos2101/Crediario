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
            Cadastre clientes, registre vendas e ajuste cobrança em Configurações.
          </p>
          <dl className="mt-8 grid gap-4 sm:grid-cols-2">
            <a
              href="/app/clientes"
              className="rounded-xl border border-slate-200 bg-white p-4"
            >
              <dt className="text-xs uppercase text-slate-500">Clientes</dt>
              <dd className="mt-1 text-sm">Cadastro com CPF cifrado</dd>
            </a>
            <Link
              href="/app/vendas"
              className="rounded-xl border border-slate-200 bg-white p-4"
            >
              <dt className="text-xs uppercase text-slate-500">Vendas</dt>
              <dd className="mt-1 text-sm">Crediário e parcelas</dd>
            </Link>
            <a
              href="/app/configuracoes"
              className="rounded-xl border border-slate-200 bg-white p-4"
            >
              <dt className="text-xs uppercase text-slate-500">Configurações</dt>
              <dd className="mt-1 text-sm">Prazos, mensagens, pagamento e Meta</dd>
            </a>
          </dl>
        </>
      )}
    </TenantFrame>
  );
}
