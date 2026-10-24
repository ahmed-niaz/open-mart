import type { Metadata } from 'next';
import './globals.css';
import { QueryProvider } from '../providers/query-provider';

export const metadata: Metadata = {
  title: 'Open-Mart | Admin & E-Commerce',
  description: 'Single-Vendor Direct-to-Consumer Store & Operations Platform',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col bg-[var(--color-page)] text-[var(--color-text-primary)] font-sans">
        <QueryProvider>{children}</QueryProvider>
      </body>
    </html>
  );
}
