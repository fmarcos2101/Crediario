import { Suspense } from 'react';
import { PRODUCT_NAME } from '@crediplus/shared';
import { InviteForm } from './invite-form';

export default function InvitePage() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center px-6 py-16">
      <p className="text-sm font-medium tracking-wide text-teal-800">{PRODUCT_NAME}</p>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight">Convite</h1>
      <p className="mt-3 mb-8 text-sm text-slate-600">Defina a senha da sua empresa.</p>
      <Suspense fallback={<p className="text-sm text-slate-600">Carregando…</p>}>
        <InviteForm />
      </Suspense>
    </main>
  );
}
