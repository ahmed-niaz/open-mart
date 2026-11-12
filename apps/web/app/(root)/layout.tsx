import type { ReactNode } from 'react';
import { StorefrontHeader } from '@/components/storefront/header/storefront-header';
import { inter } from '@/lib/fonts';

export default function StorefrontLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <div
      className={`${inter.variable} ${inter.className} [--font-sans:var(--font-inter),system-ui,-apple-system,sans-serif] flex min-h-screen flex-col bg-[#F4F2EE] font-sans text-[#252A25]`}
    >
      <StorefrontHeader />
      <main className="mx-auto w-full max-w-[1900px] flex-1 px-3 py-6 sm:px-4">
        {children}
      </main>
    </div>
  );
}
