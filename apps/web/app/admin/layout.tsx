'use client';

import * as React from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { AdminSidebar } from '@/components/admin/layout/admin-sidebar';
import { AdminHeader } from '@/components/admin/layout/admin-header';
import { useAdminAuth } from '@/hooks/admin/use-admin-auth';
import { Loader2 } from 'lucide-react';

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = React.useState(false);
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

  if (isAuthPage) {
    return <>{children}</>;
  }

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white">
        <div className="flex flex-col items-center gap-3 text-center">
          <Loader2 className="h-8 w-8 animate-spin text-[#163A2B]" />
          <p className="text-xs font-semibold text-[#6B756D] uppercase tracking-wider">
            Loading Admin Workspace...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      {/* Persistent / Mobile Sidebar */}
      <AdminSidebar
        isMobileOpen={isMobileSidebarOpen}
        onCloseMobile={() => setIsMobileSidebarOpen(false)}
      />

      {/* Main Content Area */}
      <div className="lg:pl-64 flex flex-col min-h-screen">
        <AdminHeader onOpenMobileSidebar={() => setIsMobileSidebarOpen(true)} />
        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
