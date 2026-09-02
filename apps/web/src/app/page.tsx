import { PRODUCT_NAME } from '@crediplus/shared';
import Link from 'next/link';
import { fetchApiHealth } from '@/lib/health';

export const dynamic = 'force-dynamic';

export default async function HomePage() {
  const health = await fetchApiHealth();

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-3xl flex-col justify-center px-6 py-16">
      <p className="text-sm font-medium tracking-wide text-teal-800">SaaS de crediário</p>
      <h1 className="mt-2 text-4xl font-semibold tracking-tight">{PRODUCT_NAME}</h1>
      <p className="mt-4 max-w-xl text-base leading-7 text-slate-600">
        Acesso somente por convite. O Super Admin libera a empresa depois da criação da
        senha. Não há cadastro público.
      </p>

      <dl className="mt-10 grid gap-4 sm:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">
            Interface
          </dt>
          <dd className="mt-1 text-sm text-slate-800">pt-BR · Fase 7 (cobrança)</dd>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">
            API
          </dt>
          <dd className="mt-1 text-sm text-slate-800">
            {health.state === 'ok' ? (
              <span>
                {health.product} {health.version} · operacional
              </span>
            ) : (
              <span>Indisponível ({health.reason})</span>
            )}
          </dd>
        </div>
      </dl>
      <p className="mt-10 text-sm">
        <Link className="font-medium text-teal-800 underline" href="/login">
          Entrar
        </Link>
      </p>
    </main>
  );
}
