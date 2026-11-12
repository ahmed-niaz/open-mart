'use client';

import * as React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import {
  ArrowLeft,
  ChevronRight,
  CircleUserRound,
  HelpCircle,
  Menu,
  RefreshCw,
  X,
} from 'lucide-react';
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from '@/components/ui/drawer';
import { useStorefrontCategories } from '@/hooks/storefront/use-storefront-categories';
import { inter } from '@/lib/fonts';
import {
  DRAWER_HELP_LINKS,
  DRAWER_TRENDING_LINKS,
  type StorefrontDepartment,
} from './nav-data';

interface StorefrontHamburgerDrawerProps {
  triggerLabel?: string;
  triggerClassName?: string;
  compactMobileTrigger?: boolean;
}

/**
 * Amazon-style hierarchical navigation drawer built on shadcn Base UI Drawer.
 * Dynamically populates "Shop by Department" from GET /api/categories/tree.
 */
export function StorefrontHamburgerDrawer({
  triggerLabel = 'All',
  triggerClassName,
  compactMobileTrigger = false,
}: StorefrontHamburgerDrawerProps) {
  const [open, setOpen] = React.useState(false);
  const [departmentStack, setDepartmentStack] = React.useState<
    StorefrontDepartment[]
  >([]);

  const { departments, isLoading, isError, refetch } =
    useStorefrontCategories();

  const currentDepartment =
    departmentStack.length > 0
      ? departmentStack[departmentStack.length - 1]
      : null;

  const previousLabel =
    departmentStack.length > 1
      ? departmentStack[departmentStack.length - 2].name
      : 'Main Menu';

  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen);
    if (!nextOpen) {
      setDepartmentStack([]);
    }
  };

  const closeDrawer = () => {
    setOpen(false);
    setDepartmentStack([]);
  };

  const handleBack = () => {
    setDepartmentStack((prev) => prev.slice(0, -1));
  };

  return (
    <Drawer direction="left" open={open} onOpenChange={handleOpenChange}>
      <DrawerTrigger
        aria-label={
          compactMobileTrigger
            ? 'Open navigation menu'
            : 'Open all departments menu'
        }
        className={
          triggerClassName ??
          'inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-sm border border-transparent px-3 text-[15px] font-bold text-[#FAF7F0] transition-colors hover:border-[#E8DFD0]/60 hover:bg-[#214D3A]'
        }
      >
        <Menu className="h-5 w-5 shrink-0" />
        {!compactMobileTrigger && <span>{triggerLabel}</span>}
      </DrawerTrigger>

      <DrawerContent
        className={`${inter.className} w-[88vw] max-w-[380px] border-r-[#E5E0D5] bg-white p-0 font-sans`}
        showHandle={false}
      >
        {/* Top Greeting Header (#163A2B) */}
        <DrawerHeader className="flex flex-row items-center justify-between gap-3 bg-[#163A2B] px-6 py-4 text-[#FAF7F0]">
          <Link
            href="/account"
            onClick={closeDrawer}
            className="flex min-w-0 items-center gap-3 rounded-md py-0.5 transition-opacity hover:opacity-90"
          >
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#214D3A] text-[#FAF7F0]">
              <CircleUserRound className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <DrawerTitle className="truncate text-[17px] font-bold tracking-tight text-[#FAF7F0]">
                Hello, Sign in
              </DrawerTitle>
              <p className="truncate text-xs text-[#E8DFD0]/85">
                Browse departments &amp; account
              </p>
            </div>
          </Link>

          <DrawerClose
            aria-label="Close navigation menu"
            className="flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-md text-[#E8DFD0] transition-colors hover:bg-[#214D3A] hover:text-white"
          >
            <X className="h-5 w-5" />
          </DrawerClose>
        </DrawerHeader>

        {/* Scrollable Hierarchical Menu */}
        <div className="flex-1 overflow-y-auto overscroll-contain bg-white text-[#252A25]">
          {currentDepartment ? (
            <div>
              {/* Drill-back row */}
              <button
                type="button"
                onClick={handleBack}
                className="flex w-full cursor-pointer items-center gap-2.5 border-b border-[#E5E0D5] bg-[#F4F2EE]/80 px-6 py-3.5 text-left text-[13px] font-bold tracking-wider text-[#163A2B] uppercase transition-colors hover:bg-[#E8DFD0]/60"
              >
                <ArrowLeft className="h-4 w-4 shrink-0" />
                <span>{previousLabel}</span>
              </button>

              {/* Selected Department Header */}
              <div className="border-b border-[#E5E0D5] px-6 py-4">
                <div className="flex items-center justify-between gap-3">
                  <h3 className="text-xl font-bold tracking-tight text-[#163A2B]">
                    {currentDepartment.name}
                  </h3>
                  <Link
                    href={currentDepartment.href}
                    onClick={closeDrawer}
                    className="shrink-0 rounded-full bg-[#163A2B] px-3.5 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-[#214D3A]"
                  >
                    Shop All
                  </Link>
                </div>
                {currentDepartment.description && (
                  <p className="mt-1.5 text-sm leading-relaxed text-[#6B756D]">
                    {currentDepartment.description}
                  </p>
                )}
              </div>

              {/* Nested Child Categories */}
              <ul className="divide-y divide-[#E5E0D5]/60 py-2">
                <li>
                  <Link
                    href={currentDepartment.href}
                    onClick={closeDrawer}
                    className="flex items-center justify-between px-6 py-3 text-[15px] font-semibold text-[#163A2B] transition-colors hover:bg-[#F4F2EE]"
                  >
                    <span>All {currentDepartment.name}</span>
                  </Link>
                </li>
                {currentDepartment.children.map((child) => (
                  <li key={child.id}>
                    {child.children.length > 0 ? (
                      <button
                        type="button"
                        onClick={() =>
                          setDepartmentStack((prev) => [...prev, child])
                        }
                        className="flex w-full cursor-pointer items-center justify-between px-6 py-3 text-left text-[15px] font-medium text-[#252A25] transition-colors hover:bg-[#F4F2EE] hover:text-[#163A2B]"
                      >
                        <span>{child.name}</span>
                        <ChevronRight className="h-4 w-4 shrink-0 text-[#6B756D]" />
                      </button>
                    ) : (
                      <Link
                        href={child.href}
                        onClick={closeDrawer}
                        className="flex items-center justify-between px-6 py-3 text-[15px] font-medium text-[#252A25] transition-colors hover:bg-[#F4F2EE] hover:text-[#163A2B]"
                      >
                        <span>{child.name}</span>
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <div className="divide-y divide-[#E5E0D5]">
              {/* Section 1: Trending */}
              <div className="py-3.5">
                <h3 className="px-6 py-2 text-base font-bold tracking-tight text-[#163A2B]">
                  Trending
                </h3>
                <ul>
                  {DRAWER_TRENDING_LINKS.map((item) => (
                    <li key={item.label}>
                      <Link
                        href={item.href}
                        onClick={closeDrawer}
                        className="flex items-center justify-between px-6 py-2.5 text-[15px] font-medium text-[#252A25] transition-colors hover:bg-[#F4F2EE] hover:text-[#163A2B]"
                      >
                        <span>{item.label}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Section 2: Shop by Department (Live from API) */}
              <div className="py-3.5">
                <div className="flex items-center justify-between px-6 py-2">
                  <h3 className="text-base font-bold tracking-tight text-[#163A2B]">
                    Shop by Department
                  </h3>
                  {isError && (
                    <button
                      type="button"
                      onClick={() => refetch()}
                      title="Retry loading departments"
                      className="inline-flex cursor-pointer items-center gap-1 rounded px-2 py-0.5 text-xs font-medium text-[#6B756D] hover:bg-[#F4F2EE] hover:text-[#163A2B]"
                    >
                      <RefreshCw className="h-3 w-3" />
                      Retry
                    </button>
                  )}
                </div>

                {isLoading ? (
                  <div className="space-y-2 px-6 py-2">
                    {[1, 2, 3, 4, 5].map((item) => (
                      <div
                        key={item}
                        className="h-9 w-full animate-pulse rounded-md bg-[#F4F2EE]"
                      />
                    ))}
                  </div>
                ) : departments.length === 0 ? (
                  <p className="px-6 py-3 text-sm text-[#6B756D]">
                    No departments available right now.
                  </p>
                ) : (
                  <ul>
                    {departments.map((department) => (
                      <li key={department.id}>
                        {department.children.length > 0 ? (
                          <button
                            type="button"
                            onClick={() => setDepartmentStack([department])}
                            className="flex w-full cursor-pointer items-center justify-between px-6 py-3 text-left text-[15px] font-medium text-[#252A25] transition-colors hover:bg-[#F4F2EE] hover:text-[#163A2B]"
                          >
                            <span>{department.name}</span>
                            <ChevronRight className="h-4 w-4 shrink-0 text-[#6B756D]" />
                          </button>
                        ) : (
                          <Link
                            href={department.href}
                            onClick={closeDrawer}
                            className="flex items-center justify-between px-6 py-3 text-[15px] font-medium text-[#252A25] transition-colors hover:bg-[#F4F2EE] hover:text-[#163A2B]"
                          >
                            <span>{department.name}</span>
                            <ChevronRight className="h-4 w-4 shrink-0 text-[#6B756D]" />
                          </Link>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {/* Section 3: Help & Settings */}
              <div className="py-3.5">
                <h3 className="px-6 py-2 text-base font-bold tracking-tight text-[#163A2B]">
                  Help &amp; Settings
                </h3>
                <ul>
                  {DRAWER_HELP_LINKS.map((item) => (
                    <li key={item.label}>
                      <Link
                        href={item.href}
                        onClick={closeDrawer}
                        className="flex items-center gap-2.5 px-6 py-2.5 text-[15px] font-medium text-[#252A25] transition-colors hover:bg-[#F4F2EE] hover:text-[#163A2B]"
                      >
                        {item.label === 'Customer Service' && (
                          <HelpCircle className="h-4 w-4 shrink-0 text-[#6B756D]" />
                        )}
                        <span>{item.label}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}
        </div>

        {/* Drawer Brand Footer */}
        <div className="flex items-center justify-between border-t border-[#E5E0D5] bg-[#F4F2EE] px-6 py-3.5">
          <div className="flex items-center gap-2.5">
            <div className="relative h-7 w-7 overflow-hidden rounded border border-[#E5E0D5] bg-white">
              <Image
                src="/logo.jpg"
                alt="OpenMart"
                fill
                sizes="28px"
                className="object-cover"
              />
            </div>
            <span className="text-sm font-semibold text-[#163A2B]">
              OpenMart Storefront
            </span>
          </div>
          <span className="text-xs font-medium text-[#6B756D]">
            {departments.length}{' '}
            {departments.length === 1 ? 'Department' : 'Departments'}
          </span>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
