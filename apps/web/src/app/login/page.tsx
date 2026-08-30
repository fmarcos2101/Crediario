import { PRODUCT_NAME } from '@crediplus/shared';
import { LoginForm } from './login-form';

export default function LoginPage() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center px-6 py-16">
      <p className="text-sm font-medium tracking-wide text-teal-800">{PRODUCT_NAME}</p>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight">Entrar</h1>
      <p className="mt-3 mb-8 text-sm leading-6 text-slate-600">
        Acesso por convite. Super Admin usa senha e TOTP.
      </p>
      <LoginForm />
    </main>
  );
}
