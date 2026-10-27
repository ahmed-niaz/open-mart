'use client';

import * as React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import {
  X,
  ChevronDown,
  Search,
  Heart,
  User,
  ShoppingBag,
  ExternalLink,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import type { TopNavItem } from './nav-data';

interface StorefrontMobileNavProps {
  navItems: TopNavItem[];
  isOpen: boolean;
  onClose: () => void;
  cartCount?: number;
  wishlistCount?: number;
}

export function StorefrontMobileNav({
  navItems,
  isOpen,
  onClose,
  cartCount = 0,
  wishlistCount = 0,
}: StorefrontMobileNavProps) {
  const [selectedTabId, setSelectedTabId] = React.useState<string>(
    navItems[0]?.id || 'women',
  );
  const [expandedGroupId, setExpandedGroupId] = React.useState<string | null>(
    null,
  );
  const [searchQuery, setSearchQuery] = React.useState<string>('');

  const handleClose = () => {
    setExpandedGroupId(null);
    onClose();
  };

  React.useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const currentTab =
    navItems.find((tab) => tab.id === selectedTabId) || navItems[0];

  const toggleGroup = (groupId: string) => {
    setExpandedGroupId((prev) => (prev === groupId ? null : groupId));
  };

  return (
    <div className="fixed inset-0 z-50 flex lg:hidden">
      {/* Backdrop */}
      <div
        onClick={handleClose}
        className="fixed inset-0 bg-black/60 backdrop-blur-xs transition-opacity duration-300 animate-in fade-in"
        aria-hidden="true"
      />

      {/* Drawer */}
      <div className="relative w-full max-w-sm bg-white shadow-2xl flex flex-col h-full z-10 transition-transform duration-300 animate-in slide-in-from-left">
        {/* Header with Close */}
        <div className="flex items-center justify-between border-b border-[#E5E0D5] px-4 py-3.5 bg-[#FAF9F6]">
          <span className="text-base font-extrabold tracking-tight text-[#163A2B]">
            OPEN-MART
          </span>
          <button
            type="button"
            onClick={handleClose}
            className="rounded-lg p-2 text-[#6B756D] hover:bg-white hover:text-[#252A25] transition-colors"
            aria-label="Close navigation"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Search Bar */}
        <div className="p-4 border-b border-[#E5E0D5] bg-white">
          <Input
            placeholder="Search catalog..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            leftIcon={<Search className="h-4 w-4" />}
            className="bg-[#FAF9F6]"
          />
        </div>

        {/* Top-Level Tabs (Women / Men / Accessories / Explore) */}
        <div className="flex border-b border-[#E5E0D5] bg-[#FAF9F6]/80 px-2 overflow-x-auto no-scrollbar">
          {navItems.map((tab) => {
            const isSelected = tab.id === selectedTabId;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => {
                  setSelectedTabId(tab.id);
                  setExpandedGroupId(null);
                }}
                className={`flex-1 py-3 px-3 text-center text-xs font-bold uppercase tracking-wider transition-all border-b-2 whitespace-nowrap ${
                  isSelected
                    ? 'border-[#163A2B] text-[#163A2B] bg-white'
                    : 'border-transparent text-[#6B756D] hover:text-[#252A25]'
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Scrollable Groups & Sub-items */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-2">
          {currentTab?.groups.map((group) => {
            const isExpanded = expandedGroupId === group.id;
            const isDanger = group.isDanger;

            return (
              <div
                key={group.id}
                className="border border-[#E5E0D5] rounded-xl overflow-hidden bg-white"
              >
                <button
                  type="button"
                  onClick={() => toggleGroup(group.id)}
                  className={`w-full flex items-center justify-between p-3.5 text-left text-sm font-semibold transition-colors ${
                    isDanger
                      ? 'text-red-600 bg-red-50/50'
                      : 'text-[#252A25] hover:bg-[#FAF9F6]'
                  }`}
                >
                  <span>{group.label}</span>
                  <ChevronDown
                    className={`h-4 w-4 text-[#6B756D] transition-transform duration-200 ${
                      isExpanded ? 'rotate-180' : ''
                    }`}
                  />
                </button>

                {isExpanded && (
                  <div className="border-t border-[#E5E0D5] bg-[#FAF9F6]/40 p-3 space-y-1">
                    {group.items.map((item) => (
                      <Link
                        key={item.id}
                        href={item.href}
                        onClick={handleClose}
                        className="flex items-center justify-between py-2 px-2.5 rounded-lg text-sm text-[#4A524A] hover:bg-white hover:text-[#163A2B] transition-colors"
                      >
                        <span>{item.label}</span>
                        {item.isNew && (
                          <span className="bg-[#163A2B]/10 text-[#163A2B] text-[10px] px-1.5 py-0.2 rounded font-bold uppercase">
                            New
                          </span>
                        )}
                        {item.badge && (
                          <span className="bg-red-50 text-red-600 text-[10px] px-1.5 py-0.2 rounded font-bold uppercase">
                            {item.badge}
                          </span>
                        )}
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            );
          })}

          {/* Featured Promos in Mobile Nav */}
          {currentTab?.promos && currentTab.promos.length > 0 && (
            <div className="pt-4 space-y-3">
              <div className="text-[11px] font-bold uppercase tracking-wider text-[#6B756D]">
                Featured in {currentTab.label}
              </div>
              <div className="grid grid-cols-2 gap-3">
                {currentTab.promos.map((promo) => (
                  <Link
                    key={promo.id}
                    href={promo.href}
                    onClick={handleClose}
                    className="group relative h-28 overflow-hidden rounded-xl bg-[#163A2B]"
                  >
                    <Image
                      src={promo.imageUrl}
                      alt={promo.title}
                      fill
                      unoptimized
                      sizes="180px"
                      className="object-cover opacity-75 group-hover:scale-105 transition-transform"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent" />
                    <div className="absolute bottom-2 left-2 right-2 text-white">
                      <span className="block text-xs font-bold leading-tight uppercase">
                        {promo.title}
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="border-t border-[#E5E0D5] p-4 bg-[#FAF9F6] space-y-3">
          <div className="grid grid-cols-3 gap-2 text-center text-xs font-semibold text-[#252A25]">
            <Link
              href="/wishlist"
              onClick={handleClose}
              className="flex flex-col items-center gap-1 p-2 rounded-lg bg-white border border-[#E5E0D5] hover:border-[#163A2B] transition-colors"
            >
              <Heart className="h-4 w-4 text-[#163A2B]" />
              <span>Wishlist ({wishlistCount})</span>
            </Link>
            <Link
              href="/account"
              onClick={handleClose}
              className="flex flex-col items-center gap-1 p-2 rounded-lg bg-white border border-[#E5E0D5] hover:border-[#163A2B] transition-colors"
            >
              <User className="h-4 w-4 text-[#163A2B]" />
              <span>Account</span>
            </Link>
            <Link
              href="/cart"
              onClick={handleClose}
              className="flex flex-col items-center gap-1 p-2 rounded-lg bg-white border border-[#E5E0D5] hover:border-[#163A2B] transition-colors"
            >
              <ShoppingBag className="h-4 w-4 text-[#163A2B]" />
              <span>Bag ({cartCount})</span>
            </Link>
          </div>

          <Link
            href="/admin"
            onClick={handleClose}
            className="w-full flex items-center justify-center gap-1.5 rounded-lg border border-[#E5E0D5] bg-white py-2 text-xs font-semibold text-[#163A2B] hover:bg-[#FAF9F6] transition-colors"
          >
            <span>Merchant Admin Portal</span>
            <ExternalLink className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>
    </div>
  );
}
