'use client';

import * as React from 'react';
import { Menu, Search, Bell, ShieldCheck } from 'lucide-react';
import { useAdminAuth } from '@/hooks/admin/use-admin-auth';

export function AdminHeader({
  onOpenMobileSidebar,
}: {
  onOpenMobileSidebar: () => void;
}) {
  const { admin } = useAdminAuth();

  return (
    <header className="sticky top-0 z-30 flex h-16 w-full items-center justify-between border-b border-[#E5E0D5] bg-white/95 px-4 sm:px-6 backdrop-blur-xs">
      <div className="flex items-center gap-3">
        {/* Mobile menu trigger */}
        <button
          type="button"
          onClick={onOpenMobileSidebar}
          className="flex h-9 w-9 items-center justify-center rounded-full border border-[#E5E0D5] text-[#252A25] hover:bg-[#F8F9FA] lg:hidden cursor-pointer"
        >
          <Menu className="h-5 w-5" />
        </button>

        {/* Global Search bar */}
        <div className="relative hidden md:flex items-center w-64 lg:w-80">
          <Search className="absolute left-3.5 h-4 w-4 text-[#6B756D]" />
          <input
            type="text"
            placeholder="Search orders, products, SKUs..."
            className="h-9 w-full rounded-full border border-[#E5E0D5] bg-[#F8F9FA] pl-9 pr-12 text-xs text-[#252A25] placeholder:text-[#6B756D] focus:border-[#163A2B] focus:bg-white focus:outline-none transition-all"
          />
          <div className="absolute right-2.5 hidden sm:flex items-center pointer-events-none">
            <kbd className="rounded-full border border-[#E5E0D5] bg-white px-2 py-0.5 text-[10px] font-semibold text-[#6B756D]">
              ⌘K
            </kbd>
          </div>
        </div>
      </div>

      {/* Right controls */}
      <div className="flex items-center gap-3">
        {/* Notification Bell */}
        <button
          type="button"
          title="Notifications"
          className="relative flex h-9 w-9 items-center justify-center rounded-full border border-[#E5E0D5] text-[#252A25] hover:bg-[#F8F9FA] transition-colors cursor-pointer"
        >
          <Bell className="h-4 w-4" />
          <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-[#C53030] ring-2 ring-white" />
        </button>

        <div className="h-6 w-px bg-[#E5E0D5]" />

        {/* Admin profile & Role */}
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#163A2B] text-xs font-bold text-white shadow-xs">
            {admin?.firstName ? admin.firstName.charAt(0) : 'A'}
          </div>
          <div className="hidden sm:block text-left">
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-bold text-[#252A25]">
                {admin
                  ? `${admin.firstName} ${admin.lastName}`
                  : 'Administrator'}
              </span>
              <ShieldCheck className="h-3.5 w-3.5 text-[#2F855A]" />
            </div>
            <span className="text-[10px] uppercase font-semibold text-[#6B756D]">
              {admin?.role ? admin.role.replace('_', ' ') : 'Super Admin'}
            </span>
          </div>
        </div>
      </div>
    </header>
  );
}
