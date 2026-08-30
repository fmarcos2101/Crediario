'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch, readApiError } from '@/lib/api';

type LoginResponse = {
  requiresTotp: boolean;
  challengeToken?: string;
  user?: { email: string; isSuperAdmin: boolean };
};

export function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [challengeToken, setChallengeToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function submitPassword(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);
    try {
      const response = await apiFetch('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });
      const body = (await response.json()) as
        LoginResponse | { error?: { message: string } };
      if (!response.ok) {
        setError(await messageFrom(response, body));
        return;
      }
      if ('requiresTotp' in body && body.requiresTotp && body.challengeToken) {
        setChallengeToken(body.challengeToken);
        return;
      }
      router.replace('/admin');
    } catch {
      setError('Não foi possível entrar.');
    } finally {
      setPending(false);
    }
  }

  async function submitTotp(event: React.FormEvent) {
    event.preventDefault();
    if (!challengeToken) {
      return;
    }
    setPending(true);
    setError(null);
    try {
      const response = await apiFetch('/auth/totp', {
        method: 'POST',
        body: JSON.stringify({ challengeToken, code }),
      });
      if (!response.ok) {
        setError(await readApiError(response));
        return;
      }
      router.replace('/admin');
    } catch {
      setError('Não foi possível validar o código.');
    } finally {
      setPending(false);
    }
  }

  if (challengeToken) {
    return (
      <form onSubmit={submitTotp} className="space-y-4">
        <p className="text-sm text-slate-600">
          Conta Super Admin. Informe o código de 6 dígitos do autenticador.
        </p>
        <label className="block text-sm">
          <span className="text-slate-600">Código</span>
          <input
            inputMode="numeric"
            autoComplete="one-time-code"
            value={code}
            onChange={(event) =>
              setCode(event.target.value.replace(/\D/g, '').slice(0, 6))
            }
            className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 tracking-[0.4em]"
            required
          />
        </label>
        {error ? <p className="text-sm text-red-700">{error}</p> : null}
        <button
          type="submit"
          disabled={pending || code.length !== 6}
          className="w-full rounded-lg bg-teal-800 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
        >
          {pending ? 'Validando…' : 'Confirmar'}
        </button>
      </form>
    );
  }

  return (
    <form onSubmit={submitPassword} className="space-y-4">
      <label className="block text-sm">
        <span className="text-slate-600">E-mail</span>
        <input
          type="email"
          autoComplete="username"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2"
          required
        />
      </label>
      <label className="block text-sm">
        <span className="text-slate-600">Senha</span>
        <input
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2"
          required
        />
      </label>
      {error ? <p className="text-sm text-red-700">{error}</p> : null}
      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-lg bg-teal-800 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
      >
        {pending ? 'Entrando…' : 'Entrar'}
      </button>
      <p className="text-center text-sm">
        <a className="text-teal-800 underline" href="/redefinir-senha">
          Esqueci a senha
        </a>
      </p>
    </form>
  );
}

async function messageFrom(
  response: Response,
  body: LoginResponse | { error?: { message: string } },
): Promise<string> {
  if ('error' in body && body.error?.message) {
    return body.error.message;
  }
  return readApiError(response);
}
