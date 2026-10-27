'use client';

import * as React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { ChevronRight, ArrowRight, Sparkles } from 'lucide-react';
import type { TopNavItem } from './nav-data';

interface StorefrontMegaMenuProps {
  navItem: TopNavItem;
  isOpen: boolean;
  onClose: () => void;
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
}

export function StorefrontMegaMenu({
  navItem,
  isOpen,
  onClose,
  onMouseEnter,
  onMouseLeave,
}: StorefrontMegaMenuProps) {
  // Active group within this mega menu (e.g. 'Trending', 'Leggings')
  const [selectedGroupId, setSelectedGroupId] = React.useState<string | null>(
    null,
  );

  // Derive effective active group without cascading useEffect renders
  const activeGroupId =
    selectedGroupId && navItem.groups.some((g) => g.id === selectedGroupId)
      ? selectedGroupId
      : navItem.groups[0]?.id || '';

  // Close on Escape key
  React.useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const activeGroup =
    navItem.groups.find((g) => g.id === activeGroupId) || navItem.groups[0];

  return (
    <>
      {/* 1. Backdrop Overlay (Darkens background content, exactly like Gymshark) */}
      <div
        onClick={onClose}
        className="fixed inset-0 top-[73px] z-30 bg-black/50 backdrop-blur-[2px] transition-opacity duration-200 animate-in fade-in"
        aria-hidden="true"
      />

      {/* 2. Mega Menu Container */}
      <div
        onMouseEnter={onMouseEnter}
        onMouseLeave={onMouseLeave}
        className="absolute left-0 right-0 top-full z-40 bg-white border-b border-[#E5E0D5] shadow-2xl transition-all duration-200 animate-in fade-in slide-in-from-top-1"
      >
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex flex-col lg:flex-row items-stretch gap-8">
            {/* Split Menu Panels (Left Group + Right Sub-Items) */}
            <div className="flex-1 flex flex-col md:flex-row items-stretch border border-[#E5E0D5] rounded-xl overflow-hidden bg-white shadow-xs min-h-[380px]">
              {/* Column 1: Primary Menu Groups */}
              <nav
                className="w-full md:w-64 border-b md:border-b-0 md:border-r border-[#E5E0D5] bg-[#FAF9F6]/60 p-3 space-y-1"
                aria-label={`${navItem.label} categories`}
              >
                <div className="px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-[#6B756D]">
                  {navItem.label} Collections
                </div>
                {navItem.groups.map((group) => {
                  const isActive = group.id === activeGroupId;
                  const isDanger = group.isDanger;

                  return (
                    <button
                      key={group.id}
                      type="button"
                      onMouseEnter={() => setSelectedGroupId(group.id)}
                      onClick={() => setSelectedGroupId(group.id)}
                      className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-lg text-sm font-semibold transition-all text-left ${
                        isActive
                          ? isDanger
                            ? 'bg-red-50 text-red-600 shadow-xs'
                            : 'bg-white text-[#163A2B] shadow-xs'
                          : isDanger
                            ? 'text-red-600 hover:bg-red-50/70 hover:text-red-700'
                            : 'text-[#252A25] hover:bg-white hover:text-[#163A2B]'
                      }`}
                    >
                      <span className="flex items-center gap-2">
                        {group.label}
                        {isDanger && (
                          <span className="inline-block h-1.5 w-1.5 rounded-full bg-red-600 animate-pulse" />
                        )}
                      </span>
                      <ChevronRight
                        className={`h-4 w-4 transition-transform ${
                          isActive
                            ? isDanger
                              ? 'text-red-600 translate-x-0.5'
                              : 'text-[#163A2B] translate-x-0.5'
                            : 'text-[#A0A8A2]'
                        }`}
                      />
                    </button>
                  );
                })}
              </nav>

              {/* Column 2: Sub-Menu Items (Right Side of Left Group) */}
              <div className="flex-1 p-6 bg-white flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between pb-3 mb-4 border-b border-[#F0ECE3]">
                    <h3 className="text-sm font-bold uppercase tracking-wider text-[#163A2B] flex items-center gap-2">
                      <span>{activeGroup?.label}</span>
                      {activeGroup?.isDanger && (
                        <span className="bg-red-100 text-red-700 text-[10px] px-2 py-0.5 rounded-full font-bold">
                          SALE
                        </span>
                      )}
                    </h3>
                    <Link
                      href={activeGroup?.href || `/category/${navItem.id}`}
                      onClick={onClose}
                      className="text-xs font-semibold text-[#163A2B] hover:text-[#214D3A] flex items-center gap-1 group"
                    >
                      <span>View All</span>
                      <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
                    </Link>
                  </div>

                  <ul className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-2.5">
                    {activeGroup?.items.map((item) => (
                      <li key={item.id}>
                        <Link
                          href={item.href}
                          onClick={onClose}
                          className="group flex items-center justify-between py-1.5 text-sm text-[#4A524A] hover:text-[#163A2B] transition-colors"
                        >
                          <span className="group-hover:translate-x-1 transition-transform inline-flex items-center gap-2">
                            {item.label}
                            {item.isNew && (
                              <span className="bg-[#163A2B]/10 text-[#163A2B] text-[10px] px-1.5 py-0.2 rounded font-bold uppercase tracking-wider">
                                New
                              </span>
                            )}
                            {item.badge && (
                              <span className="bg-red-50 text-red-600 text-[10px] px-1.5 py-0.2 rounded font-bold uppercase tracking-wider">
                                {item.badge}
                              </span>
                            )}
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Sub-menu Footer Prompt */}
                <div className="mt-8 pt-3 border-t border-[#F0ECE3] flex items-center justify-between text-xs text-[#6B756D]">
                  <span className="inline-flex items-center gap-1.5">
                    <Sparkles className="h-3.5 w-3.5 text-[#163A2B]" />
                    Single-vendor direct checkout with authentic quality
                  </span>
                  <Link
                    href={`/category/${navItem.id}`}
                    onClick={onClose}
                    className="font-semibold text-[#163A2B] hover:underline"
                  >
                    Browse full {navItem.label} catalog &rarr;
                  </Link>
                </div>
              </div>
            </div>

            {/* Promotional Cards Section (Bottom / Right Side of Mega Menu) */}
            {navItem.promos && navItem.promos.length > 0 && (
              <div className="w-full lg:w-80 flex flex-row lg:flex-col gap-4">
                {navItem.promos.map((promo) => (
                  <Link
                    key={promo.id}
                    href={promo.href}
                    onClick={onClose}
                    className="group relative flex-1 h-44 lg:h-48 overflow-hidden rounded-xl border border-[#E5E0D5] bg-[#163A2B] shadow-xs"
                  >
                    <Image
                      src={promo.imageUrl}
                      alt={promo.title}
                      fill
                      unoptimized
                      sizes="(max-width: 1024px) 50vw, 320px"
                      className="object-cover transition-transform duration-500 group-hover:scale-105 opacity-80 group-hover:opacity-90"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />
                    <div className="absolute bottom-3 left-3 right-3 text-white">
                      <span className="text-[10px] font-bold uppercase tracking-widest text-[#FAF7F0]/80">
                        Featured
                      </span>
                      <h4 className="text-base font-extrabold uppercase tracking-wide text-white drop-shadow-xs">
                        {promo.title}
                      </h4>
                      {promo.subtitle && (
                        <p className="text-xs text-[#E5E0D5] line-clamp-1 mt-0.5">
                          {promo.subtitle}
                        </p>
                      )}
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
