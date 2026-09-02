'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { apiFetch, readApiError } from '@/lib/api';

export function InviteForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token') ?? '';
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);
    try {
      const response = await apiFetch('/auth/invite/accept', {
        method: 'POST',
        body: JSON.stringify({ token, password }),
      });
      if (!response.ok) {
        setError(await readApiError(response));
        return;
      }
      router.replace('/login');
    } catch {
      setError('Não foi possível aceitar o convite.');
    } finally {
      setPending(false);
    }
  }

  if (!token) {
    return <p className="text-sm text-slate-600">Convite inválido.</p>;
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <label className="block text-sm">
        <span className="text-slate-600">Senha (mín. 12)</span>
        <input
          type="password"
          autoComplete="new-password"
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
        className="w-full rounded-lg bg-teal-800 px-4 py-2 text-sm text-white disabled:opacity-60"
      >
        {pending ? 'Salvando…' : 'Criar senha'}
      </button>
      <p className="text-sm text-slate-600">
        Depois disso o Super Admin ainda precisa liberar a empresa.
      </p>
    </form>
  );
}
