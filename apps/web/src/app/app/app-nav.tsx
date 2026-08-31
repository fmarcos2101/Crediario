'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const LINKS = [
  { href: '/app', label: 'Painel' },
  { href: '/app/clientes', label: 'Clientes' },
  { href: '/app/configuracoes', label: 'Configurações' },
];

export function AppNav({ name, onLogout }: { name: string; onLogout: () => void }) {
  const pathname = usePathname();
  return (
    <header className="mb-10 flex flex-wrap items-end justify-between gap-4">
      <div>
        <p className="text-sm font-medium tracking-wide text-teal-800">{name}</p>
        <nav className="mt-3 flex flex-wrap gap-4 text-sm">
          {LINKS.map((link) => {
            const active =
              link.href === '/app' ? pathname === '/app' : pathname.startsWith(link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                className={
                  active ? 'font-medium text-teal-800' : 'text-slate-600 underline'
                }
              >
                {link.label}
              </Link>
            );
          })}
        </nav>
      </div>
      <button
        type="button"
        onClick={onLogout}
        className="rounded-lg border border-slate-300 px-4 py-2 text-sm"
      >
        Sair
      </button>
    </header>
  );
}
