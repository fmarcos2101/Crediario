import type { Metadata } from 'next';
import { PRODUCT_NAME } from '@crediplus/shared';
import './globals.css';

export const metadata: Metadata = {
  title: PRODUCT_NAME,
  description: 'Gestão de crediário para múltiplas empresas.',
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body className="bg-slate-50 text-slate-900 antialiased">{children}</body>
    </html>
  );
}
