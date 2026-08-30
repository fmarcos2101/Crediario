'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch, readApiError } from '@/lib/api';

export default function ResetPasswordPage() {
  const router = useRouter();
  const token = useMemo(() => {
    if (typeof window === 'undefined') {
      return '';
    }
    return new URLSearchParams(window.location.search).get('token') ?? '';
  }, []);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function requestReset(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);
    try {
      const response = await apiFetch('/auth/password/forgot', {
        method: 'POST',
        body: JSON.stringify({ email }),
      });
      if (!response.ok) {
        setError(await readApiError(response));
        return;
      }
      setMessage('Se o e-mail existir, enviamos as instruções.');
    } finally {
      setPending(false);
    }
  }

  async function confirmReset(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);
    try {
      const response = await apiFetch('/auth/password/reset', {
        method: 'POST',
        body: JSON.stringify({ token, password }),
      });
      if (!response.ok) {
        setError(await readApiError(response));
        return;
      }
      router.replace('/login');
    } finally {
      setPending(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center px-6 py-16">
      <h1 className="text-3xl font-semibold tracking-tight">Redefinir senha</h1>
      {token ? (
        <form onSubmit={confirmReset} className="mt-8 space-y-4">
          <label className="block text-sm">
            <span className="text-slate-600">Nova senha (mín. 12)</span>
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
              minLength={12}
              required
            />
          </label>
          {error ? <p className="text-sm text-red-700">{error}</p> : null}
          <button
            type="submit"
            disabled={pending}
            className="w-full rounded-lg bg-teal-800 px-4 py-2 text-sm text-white"
          >
            Salvar senha
          </button>
        </form>
      ) : (
        <form onSubmit={requestReset} className="mt-8 space-y-4">
          <label className="block text-sm">
            <span className="text-slate-600">E-mail</span>
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
              required
            />
          </label>
          {error ? <p className="text-sm text-red-700">{error}</p> : null}
          {message ? <p className="text-sm text-teal-800">{message}</p> : null}
          <button
            type="submit"
            disabled={pending}
            className="w-full rounded-lg bg-teal-800 px-4 py-2 text-sm text-white"
          >
            Enviar instruções
          </button>
        </form>
      )}
    </main>
  );
}
