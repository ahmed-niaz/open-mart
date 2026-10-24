'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Package,
  Layers,
  ShoppingCart,
  Warehouse,
  Tag,
  CreditCard,
  Users,
  LogOut,
  ShoppingBag,
  ExternalLink,
} from 'lucide-react';
import { useAdminAuth } from '@/hooks/admin/use-admin-auth';
import { cn } from '@/lib/utils';

interface NavItem {
  title: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
}

interface NavGroup {
  group: string;
  items: NavItem[];
}

const NAVIGATION_GROUPS: NavGroup[] = [
  {
    group: 'MAIN',
    items: [
      {
        title: 'Dashboard',
        href: '/admin',
        icon: LayoutDashboard,
      },
    ],
  },
  {
    group: 'CATALOG',
    items: [
      {
        title: 'Products',
        href: '/admin/products',
        icon: Package,
      },
      {
        title: 'Categories',
        href: '/admin/categories',
        icon: Layers,
      },
    ],
  },
  {
    group: 'SALES & LOGISTICS',
    items: [
      {
        title: 'Orders',
        href: '/admin/orders',
        icon: ShoppingCart,
      },
      {
        title: 'Customers',
        href: '/admin/customers',
        icon: Users,
      },
    ],
  },
  {
    group: 'INVENTORY',
    items: [
      {
        title: 'Stock Management',
        href: '/admin/inventory',
        icon: Warehouse,
      },
    ],
  },
  {
    group: 'MARKETING',
    items: [
      {
        title: 'Discounts & Coupons',
        href: '/admin/discounts',
        icon: Tag,
      },
    ],
  },
  {
    group: 'FINANCIALS',
    items: [
      {
        title: 'Payments & Refunds',
        href: '/admin/payments',
        icon: CreditCard,
      },
    ],
  },
  {
    group: 'SYSTEM',
    items: [
      {
        title: 'Staff & Roles',
        href: '/admin/settings/users',
        icon: Users,
      },
    ],
  },
];

export function AdminSidebar({
  isMobileOpen = false,
  onCloseMobile,
}: {
  isMobileOpen?: boolean;
  onCloseMobile?: () => void;
}) {
  const pathname = usePathname();
  const { admin, logout, isLoggingOut } = useAdminAuth();

  const sidebarContent = (
    <div className="flex h-full flex-col justify-between bg-[#163A2B] text-white">
      {/* Brand Header */}
      <div>
        <div className="flex h-16 items-center gap-3 px-6 border-b border-[#214D3A]">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/10 text-white shadow-inner">
            <ShoppingBag className="h-5 w-5 text-[#FAF7F0]" />
          </div>
          <div>
            <span className="text-base font-extrabold tracking-wider text-white">
              OPEN-MART
            </span>
            <span className="block text-[10px] font-semibold uppercase tracking-widest text-[#E8DFD0]/70">
              Merchant Admin
            </span>
          </div>
        </div>

        {/* Navigation list */}
        <div className="py-4 px-3 space-y-6 overflow-y-auto max-h-[calc(100vh-140px)]">
          {NAVIGATION_GROUPS.map((group) => (
            <div key={group.group} className="space-y-1">
              <p className="px-3 text-[10px] font-bold tracking-widest text-[#E8DFD0]/50 uppercase">
                {group.group}
              </p>
              <div className="mt-1 space-y-0.5">
                {group.items.map((item) => {
                  const isActive =
                    item.href === '/admin'
                      ? pathname === '/admin'
                      : pathname.startsWith(item.href);
                  const Icon = item.icon;

                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={onCloseMobile}
                      className={cn(
                        'flex items-center gap-3 rounded-full px-3.5 py-2 text-xs font-medium transition-all select-none',
                        isActive
                          ? 'bg-[#214D3A] text-white shadow-xs font-semibold'
                          : 'text-[#FAF7F0]/75 hover:bg-white/5 hover:text-white',
                      )}
                    >
                      <Icon
                        className={cn(
                          'h-4 w-4',
                          isActive ? 'text-[#FAF7F0]' : 'text-[#E8DFD0]/60',
                        )}
                      />
                      <span>{item.title}</span>
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}

          {/* Quick link to storefront */}
          <div className="pt-2 px-1">
            <Link
              href="/"
              target="_blank"
              className="flex items-center justify-between rounded-full border border-[#214D3A] bg-white/5 px-3.5 py-2 text-xs font-medium text-[#FAF7F0]/80 hover:bg-white/10 hover:text-white transition-colors"
            >
              <span className="flex items-center gap-2">
                <ExternalLink className="h-3.5 w-3.5 text-[#E8DFD0]/70" />
                Live Storefront
              </span>
              <span className="text-[10px] bg-white/10 px-2 py-0.5 rounded-full text-[#E8DFD0]">
                Visit
              </span>
            </Link>
          </div>
        </div>
      </div>

      {/* Admin User Card Footer */}
      <div className="border-t border-[#214D3A] p-4 bg-[#122e22]">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#2F855A] text-xs font-bold text-white uppercase shadow-inner">
              {admin?.firstName ? admin.firstName.charAt(0) : 'A'}
              {admin?.lastName ? admin.lastName.charAt(0) : 'D'}
            </div>
            <div className="overflow-hidden">
              <p className="truncate text-xs font-semibold text-white">
                {admin
                  ? `${admin.firstName} ${admin.lastName}`
                  : 'Administrator'}
              </p>
              <span className="inline-block text-[10px] font-medium uppercase text-[#E8DFD0]/70">
                {admin?.role ? admin.role.replace('_', ' ') : 'Super Admin'}
              </span>
            </div>
          </div>
          <button
            onClick={() => logout()}
            disabled={isLoggingOut}
            title="Log Out"
            className="flex h-8 w-8 items-center justify-center rounded-full text-[#E8DFD0]/70 hover:bg-white/10 hover:text-white transition-colors cursor-pointer"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Persistent Sidebar */}
      <aside className="hidden lg:fixed lg:inset-y-0 lg:z-40 lg:flex lg:w-64 lg:flex-col border-r border-[#214D3A]/40 shadow-sm">
        {sidebarContent}
      </aside>

      {/* Mobile Drawer */}
      {isMobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="fixed inset-0 bg-[#252A25]/50 backdrop-blur-xs transition-opacity"
            onClick={onCloseMobile}
          />
          <div className="fixed inset-y-0 left-0 z-50 w-64 shadow-2xl animate-in slide-in-from-left duration-200">
            {sidebarContent}
          </div>
        </div>
      )}
    </>
  );
}
