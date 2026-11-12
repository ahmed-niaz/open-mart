'use client';

import * as React from 'react';
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
  Image as ImageIcon,
} from 'lucide-react';
import {
  Sidebar,
  SidebarNavGroup,
  SidebarNavItem,
  SidebarTrigger,
  useSidebarView,
} from '@/components/ui/sidebar';
import { useAdminAuth } from '@/hooks/admin/use-admin-auth';
import { manrope } from '@/lib/fonts';
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
      {
        title: 'Media Library',
        href: '/admin/media',
        icon: ImageIcon,
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

function AdminSidebarBody() {
  const pathname = usePathname();
  const { admin, logout, isLoggingOut } = useAdminAuth();
  const { isCollapsed } = useSidebarView();

  const initials = `${admin?.firstName ? admin.firstName.charAt(0) : 'A'}${
    admin?.lastName ? admin.lastName.charAt(0) : 'D'
  }`;

  return (
    <div className="flex h-full flex-col justify-between bg-[#163A2B] text-white">
      {/* Top Header + Navigation */}
      <div className="flex min-h-0 flex-1 flex-col">
        {/* Brand Header */}
        <div
          className={cn(
            'flex h-16 shrink-0 items-center border-b border-[#214D3A]',
            isCollapsed ? 'justify-center px-2' : 'justify-between px-4',
          )}
        >
          <div className="flex min-w-0 items-center gap-3">
            <div
              title={isCollapsed ? 'OPEN-MART Admin' : undefined}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/10 text-white shadow-inner"
            >
              <ShoppingBag className="h-5 w-5 text-[#FAF7F0]" />
            </div>
            {!isCollapsed && (
              <div className="min-w-0">
                <span className="block truncate text-lg font-extrabold tracking-wider text-white">
                  OPEN-MART
                </span>
                <span className="block truncate text-[11px] font-semibold tracking-widest text-[#E8DFD0]/75 uppercase">
                  Merchant Admin
                </span>
              </div>
            )}
          </div>

          {!isCollapsed && (
            <SidebarTrigger
              mode="desktop"
              className="border-[#214D3A] bg-white/5 text-[#E8DFD0] hover:bg-white/15 hover:text-white"
            />
          )}
        </div>

        {/* Scrollable Navigation List */}
        <div
          className={cn(
            'flex-1 overflow-y-auto py-4',
            isCollapsed ? 'space-y-2 px-2' : 'space-y-5 px-3',
          )}
        >
          {NAVIGATION_GROUPS.map((group) => (
            <SidebarNavGroup key={group.group} label={group.group}>
              {group.items.map((item) => {
                const isActive =
                  item.href === '/admin'
                    ? pathname === '/admin'
                    : pathname.startsWith(item.href);

                return (
                  <SidebarNavItem
                    key={item.href}
                    title={item.title}
                    href={item.href}
                    icon={item.icon}
                    isActive={isActive}
                  />
                );
              })}
            </SidebarNavGroup>
          ))}

          {/* Quick link to storefront */}
          <div className={cn('pt-2', !isCollapsed && 'px-1')}>
            <SidebarNavItem
              title="Live Storefront"
              href="/"
              target="_blank"
              icon={ExternalLink}
              isActive={false}
              badge="Visit"
            />
          </div>
        </div>
      </div>

      {/* Admin User Card Footer */}
      <div
        className={cn(
          'shrink-0 border-t border-[#214D3A] bg-[#122e22]',
          isCollapsed ? 'p-2.5' : 'p-4',
        )}
      >
        <div
          className={cn(
            'flex items-center',
            isCollapsed ? 'flex-col gap-2' : 'justify-between',
          )}
        >
          <div
            title={
              isCollapsed
                ? admin
                  ? `${admin.firstName} ${admin.lastName}`
                  : 'Administrator'
                : undefined
            }
            className="flex min-w-0 items-center gap-3"
          >
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#2F855A] text-sm font-bold text-white uppercase shadow-inner">
              {initials}
            </div>
            {!isCollapsed && (
              <div className="min-w-0 overflow-hidden">
                <p className="truncate text-sm font-semibold text-white">
                  {admin
                    ? `${admin.firstName} ${admin.lastName}`
                    : 'Administrator'}
                </p>
                <span className="inline-block truncate text-[11px] font-medium text-[#E8DFD0]/75 uppercase">
                  {admin?.role ? admin.role.replace('_', ' ') : 'Super Admin'}
                </span>
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={() => logout()}
            disabled={isLoggingOut}
            title="Log Out"
            aria-label="Log Out"
            className="flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-full text-[#E8DFD0]/75 transition-colors hover:bg-white/10 hover:text-white"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

export function AdminSidebar() {
  return (
    <Sidebar
      className="border-r border-[#214D3A]/40 bg-[#163A2B] shadow-sm"
      drawerTitle="Admin Navigation"
      drawerClassName={`${manrope.variable} ${manrope.className} [--font-sans:var(--font-manrope),system-ui,-apple-system,sans-serif] bg-[#163A2B] font-sans text-white`}
    >
      <AdminSidebarBody />
    </Sidebar>
  );
}
