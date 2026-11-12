'use client';

import * as React from 'react';
import Link from 'next/link';
import { Menu, PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import { Drawer, DrawerContent, DrawerTitle } from '@/components/ui/drawer';
import { cn } from '@/lib/utils';

interface SidebarContextValue {
  collapsed: boolean;
  setCollapsed: (next: boolean) => void;
  toggleCollapsed: () => void;
  mobileOpen: boolean;
  setMobileOpen: (next: boolean) => void;
  toggleMobile: () => void;
}

const SidebarContext = React.createContext<SidebarContextValue | null>(null);

interface SidebarViewContextValue {
  isCollapsed: boolean;
  onNavigate?: () => void;
}

const SidebarViewContext = React.createContext<SidebarViewContextValue>({
  isCollapsed: false,
});

function emitStorageEvent(key: string) {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('sidebar-storage', { detail: key }));
  }
}

export interface SidebarProviderProps {
  children: React.ReactNode;
  defaultCollapsed?: boolean;
  storageKey?: string;
}

/**
 * Provides shared desktop collapse state (persisted in localStorage) and mobile
 * drawer state across Sidebar, SidebarInset, and SidebarTrigger components.
 */
export function SidebarProvider({
  children,
  defaultCollapsed = false,
  storageKey = 'openmart_sidebar_collapsed',
}: SidebarProviderProps) {
  const [mobileOpen, setMobileOpen] = React.useState(false);

  const subscribe = React.useCallback(
    (onStoreChange: () => void) => {
      if (typeof window === 'undefined') return () => {};
      const handleStorage = (event: StorageEvent) => {
        if (event.key === storageKey) onStoreChange();
      };
      const handleCustom = (event: Event) => {
        if ((event as CustomEvent<string>).detail === storageKey) {
          onStoreChange();
        }
      };
      window.addEventListener('storage', handleStorage);
      window.addEventListener('sidebar-storage', handleCustom);
      return () => {
        window.removeEventListener('storage', handleStorage);
        window.removeEventListener('sidebar-storage', handleCustom);
      };
    },
    [storageKey],
  );

  const getSnapshot = React.useCallback(() => {
    if (typeof window === 'undefined') return defaultCollapsed;
    try {
      const saved = window.localStorage.getItem(storageKey);
      return saved === null ? defaultCollapsed : saved === 'true';
    } catch {
      return defaultCollapsed;
    }
  }, [defaultCollapsed, storageKey]);

  const collapsed = React.useSyncExternalStore(
    subscribe,
    getSnapshot,
    () => defaultCollapsed,
  );

  const setCollapsed = React.useCallback(
    (next: boolean) => {
      try {
        window.localStorage.setItem(storageKey, String(next));
      } catch {
        // Ignore storage quota / private-browsing errors
      }
      emitStorageEvent(storageKey);
    },
    [storageKey],
  );

  const toggleCollapsed = React.useCallback(() => {
    setCollapsed(!collapsed);
  }, [collapsed, setCollapsed]);

  const toggleMobile = React.useCallback(() => {
    setMobileOpen((prev) => !prev);
  }, []);

  const value = React.useMemo<SidebarContextValue>(
    () => ({
      collapsed,
      setCollapsed,
      toggleCollapsed,
      mobileOpen,
      setMobileOpen,
      toggleMobile,
    }),
    [collapsed, setCollapsed, toggleCollapsed, mobileOpen, toggleMobile],
  );

  return (
    <SidebarContext.Provider value={value}>{children}</SidebarContext.Provider>
  );
}

export function useSidebar(): SidebarContextValue {
  const context = React.useContext(SidebarContext);
  if (!context) {
    throw new Error('useSidebar must be used within a SidebarProvider');
  }
  return context;
}

export function useSidebarView(): SidebarViewContextValue {
  return React.useContext(SidebarViewContext);
}

export interface SidebarProps {
  children: React.ReactNode;
  className?: string;
  drawerClassName?: string;
  drawerTitle?: string;
}

/**
 * Dual-mode navigation shell:
 * - Desktop (lg+): smooth collapsible rail (expanded w-64 vs icon-only w-[76px])
 * - Mobile (< lg): slide-over Tailwind Base UI Drawer sharing identical children
 */
export function Sidebar({
  children,
  className,
  drawerClassName,
  drawerTitle = 'Navigation',
}: SidebarProps) {
  const { collapsed, mobileOpen, setMobileOpen } = useSidebar();

  const closeMobile = React.useCallback(() => {
    setMobileOpen(false);
  }, [setMobileOpen]);

  return (
    <>
      {/* Desktop Collapsible Sidebar Rail */}
      <aside
        data-collapsed={collapsed}
        className={cn(
          'hidden lg:fixed lg:inset-y-0 lg:left-0 lg:z-40 lg:flex lg:flex-col overflow-hidden transition-[width] duration-200 ease-out',
          collapsed ? 'lg:w-[76px]' : 'lg:w-64',
          className,
        )}
      >
        <SidebarViewContext.Provider value={{ isCollapsed: collapsed }}>
          {children}
        </SidebarViewContext.Provider>
      </aside>

      {/* Mobile Slide-Over Tailwind Drawer */}
      <div className="lg:hidden">
        <Drawer direction="left" open={mobileOpen} onOpenChange={setMobileOpen}>
          <DrawerContent
            showHandle={false}
            className={cn(
              'w-[82vw] max-w-[280px] border-r-0 p-0',
              drawerClassName,
            )}
          >
            <DrawerTitle className="sr-only">{drawerTitle}</DrawerTitle>
            <SidebarViewContext.Provider
              value={{ isCollapsed: false, onNavigate: closeMobile }}
            >
              {children}
            </SidebarViewContext.Provider>
          </DrawerContent>
        </Drawer>
      </div>
    </>
  );
}

/**
 * Main workspace container that shifts cleanly with the desktop sidebar width.
 */
export function SidebarInset({
  className,
  children,
}: React.HTMLAttributes<HTMLDivElement>) {
  const { collapsed } = useSidebar();

  return (
    <div
      className={cn(
        'flex min-h-screen flex-col transition-[padding] duration-200 ease-out',
        collapsed ? 'lg:pl-[76px]' : 'lg:pl-64',
        className,
      )}
    >
      {children}
    </div>
  );
}

export interface SidebarTriggerProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  mode?: 'auto' | 'desktop' | 'mobile';
}

/**
 * Reusable trigger button that expands/collapses the desktop sidebar rail or
 * opens the mobile Tailwind Drawer.
 */
export function SidebarTrigger({
  mode = 'auto',
  className,
  ...props
}: SidebarTriggerProps) {
  const { collapsed, toggleCollapsed, toggleMobile } = useSidebar();

  const desktopButton = (
    <button
      type="button"
      onClick={toggleCollapsed}
      aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
      aria-expanded={!collapsed}
      title={collapsed ? 'Expand sidebar' : 'Collapse sidebar (icon-only)'}
      className={cn(
        mode === 'desktop' ? 'inline-flex' : 'hidden lg:inline-flex',
        'h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-lg border border-[#E5E0D5] text-[#252A25] transition-colors hover:bg-[#F8F9FA] hover:text-[#163A2B]',
        className,
      )}
      {...props}
    >
      {collapsed ? (
        <PanelLeftOpen className="h-[18px] w-[18px]" />
      ) : (
        <PanelLeftClose className="h-[18px] w-[18px]" />
      )}
    </button>
  );

  const mobileButton = (
    <button
      type="button"
      onClick={toggleMobile}
      aria-label="Open navigation menu"
      className={cn(
        mode === 'mobile' ? 'inline-flex' : 'inline-flex lg:hidden',
        'h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-full border border-[#E5E0D5] text-[#252A25] transition-colors hover:bg-[#F8F9FA]',
        className,
      )}
      {...props}
    >
      <Menu className="h-5 w-5" />
    </button>
  );

  if (mode === 'desktop') return desktopButton;
  if (mode === 'mobile') return mobileButton;

  return (
    <>
      {mobileButton}
      {desktopButton}
    </>
  );
}

export interface SidebarNavGroupProps {
  label: string;
  children: React.ReactNode;
}

export function SidebarNavGroup({ label, children }: SidebarNavGroupProps) {
  const { isCollapsed } = useSidebarView();

  return (
    <div className="space-y-1">
      {isCollapsed ? (
        <div aria-hidden="true" className="mx-3 my-2 h-px bg-[#214D3A]/70" />
      ) : (
        <p className="px-3 text-[11px] font-bold tracking-widest text-[#E8DFD0]/60 uppercase">
          {label}
        </p>
      )}
      <div className="mt-1 space-y-1">{children}</div>
    </div>
  );
}

export interface SidebarNavItemProps {
  title: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  isActive: boolean;
  badge?: string;
  target?: string;
}

export function SidebarNavItem({
  title,
  href,
  icon: Icon,
  isActive,
  badge,
  target,
}: SidebarNavItemProps) {
  const { isCollapsed, onNavigate } = useSidebarView();

  return (
    <Link
      href={href}
      target={target}
      onClick={onNavigate}
      title={isCollapsed ? title : undefined}
      aria-label={isCollapsed ? title : undefined}
      className={cn(
        'group flex items-center rounded-xl text-sm font-medium transition-all select-none',
        isCollapsed
          ? 'mx-auto h-10 w-10 justify-center px-0'
          : 'gap-3 rounded-full px-3.5 py-2.5',
        isActive
          ? 'bg-[#214D3A] font-semibold text-white shadow-xs'
          : 'text-[#FAF7F0]/80 hover:bg-white/10 hover:text-white',
      )}
    >
      <Icon
        className={cn(
          'h-[18px] w-[18px] shrink-0 transition-transform group-hover:scale-105',
          isActive
            ? 'text-[#FAF7F0]'
            : 'text-[#E8DFD0]/70 group-hover:text-white',
        )}
      />
      {!isCollapsed && (
        <>
          <span className="truncate">{title}</span>
          {badge && (
            <span className="ml-auto rounded-full bg-white/10 px-2 py-0.5 text-[11px] font-medium text-[#E8DFD0]">
              {badge}
            </span>
          )}
        </>
      )}
    </Link>
  );
}
