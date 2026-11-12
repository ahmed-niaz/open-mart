'use client';

import * as React from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { AdminSidebar } from '@/components/admin/layout/admin-sidebar';
import { AdminHeader } from '@/components/admin/layout/admin-header';
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar';
import { useAdminAuth } from '@/hooks/admin/use-admin-auth';
import { manrope } from '@/lib/fonts';
import { Loader2 } from 'lucide-react';

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { isLoading, isAuthenticated, refetch } = useAdminAuth();

  // If on login or register page, render full screen without dashboard chrome
  const isAuthPage =
    pathname === '/admin/login' || pathname === '/admin/register';

  // Check for auth_token in query string from Google OAuth callback
  React.useEffect(() => {
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search);
      const authToken = urlParams.get('auth_token');
      if (authToken) {
        localStorage.setItem('admin_access_token', authToken);
        window.history.replaceState({}, '', window.location.pathname);
        refetch();
      }
    }
  }, [refetch]);

  React.useEffect(() => {
    if (!isLoading && !isAuthenticated && !isAuthPage) {
      router.push('/admin/login');
    }
  }, [isLoading, isAuthenticated, isAuthPage, router]);

  const adminFontClass = `${manrope.variable} ${manrope.className} [--font-sans:var(--font-manrope),system-ui,-apple-system,sans-serif] font-sans text-[15px] leading-relaxed`;

  if (isAuthPage) {
    return <div className={adminFontClass}>{children}</div>;
  }

  if (isLoading) {
    return (
      <div
        className={`${adminFontClass} flex min-h-screen items-center justify-center bg-white`}
      >
        <div className="flex flex-col items-center gap-3 text-center">
          <Loader2 className="h-8 w-8 animate-spin text-[#163A2B]" />
          <p className="text-sm font-semibold text-[#6B756D] uppercase tracking-wider">
            Loading Admin Workspace...
          </p>
        </div>
      </div>
    );
  }

  return (
    <SidebarProvider storageKey="openmart_admin_sidebar_collapsed">
      <div className={`${adminFontClass} min-h-screen bg-white`}>
        {/* Desktop Collapsible Rail + Mobile Tailwind Drawer */}
        <AdminSidebar />

        {/* Main Content Area synced with sidebar width */}
        <SidebarInset>
          <AdminHeader />
          <main className="flex-1 min-w-0 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto">
            {children}
          </main>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}
