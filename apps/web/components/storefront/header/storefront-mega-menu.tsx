'use client';

import * as React from 'react';
import Link from 'next/link';
import { ChevronRight, ArrowRight } from 'lucide-react';
import type { TopNavItem } from './nav-data';

interface StorefrontMegaMenuProps {
  navItem: TopNavItem;
  isOpen: boolean;
  headerHeight?: number;
  onClose: () => void;
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
}

export function StorefrontMegaMenu({
  navItem,
  isOpen,
  headerHeight = 105,
  onClose,
  onMouseEnter,
  onMouseLeave,
}: StorefrontMegaMenuProps) {
  // Active group within this mega menu (e.g. 'Trending', 'Leggings')
  const [selectedGroupId, setSelectedGroupId] = React.useState<string | null>(null);

  // Derive effective active group
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
      {/* 1. Darkened Backdrop Overlay (Matches Gymshark dimmed hero background) */}
      <div
        onClick={onClose}
        style={{ top: `${headerHeight}px` }}
        className="fixed inset-x-0 bottom-0 z-30 bg-black/60 backdrop-blur-[2px] transition-opacity duration-200 animate-in fade-in"
        aria-hidden="true"
      />

      {/* 2. Anchored Mega Menu Split Flyout (Left Column + Right Column) */}
      <div
        onMouseEnter={onMouseEnter}
        onMouseLeave={onMouseLeave}
        className="absolute left-0 sm:left-4 lg:left-8 top-full z-40 bg-white border border-[#E5E0D5] shadow-2xl rounded-b-xl overflow-hidden transition-all duration-200 animate-in fade-in slide-in-from-top-1 w-full max-w-[530px]"
      >
        <div className="flex flex-row items-stretch min-h-[420px]">
          {/* COLUMN 1 (Left): Menu Categories + Stacked Promo Cards */}
          <div className="w-[230px] shrink-0 border-r border-[#E5E0D5] bg-white flex flex-col justify-between">
            {/* Top Categories Navigation List */}
            <nav className="p-2 space-y-0.5" aria-label={`${navItem.label} categories`}>
              {navItem.groups.map((group) => {
                const isActive = group.id === activeGroupId;
                const isDanger = group.isDanger;

                return (
                  <button
                    key={group.id}
                    type="button"
                    onMouseEnter={() => setSelectedGroupId(group.id)}
                    onClick={() => setSelectedGroupId(group.id)}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-md text-[13px] font-semibold transition-all text-left ${
                      isActive
                        ? isDanger
                          ? 'bg-red-50 text-red-600 font-bold'
                          : 'bg-[#FAF9F6] text-[#163A2B] font-bold'
                        : isDanger
                          ? 'text-red-600 hover:bg-red-50/70'
                          : 'text-[#252A25] hover:bg-[#FAF9F6] hover:text-[#163A2B]'
                    }`}
                  >
                    <span className="flex items-center gap-1.5 truncate">
                      {group.label}
                      {isDanger && (
                        <span className="inline-block h-1.5 w-1.5 rounded-full bg-red-600 animate-pulse" />
                      )}
                    </span>
                    <ChevronRight
                      className={`h-3.5 w-3.5 shrink-0 transition-transform ${
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

            {/* Bottom Stacked Promo Cards (Positioned directly under Column 1 like Gymshark) */}
            {navItem.promos && navItem.promos.length > 0 && (
              <div className="p-2 pt-2 border-t border-[#F0ECE3] space-y-2 bg-[#FAF9F6]/50">
                {navItem.promos.slice(0, 2).map((promo) => (
                  <Link
                    key={promo.id}
                    href={promo.href}
                    onClick={onClose}
                    className="group relative block h-[84px] w-full overflow-hidden rounded-lg bg-[#163A2B] shadow-xs"
                  >
                    {promo.imageUrl && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={promo.imageUrl}
                        alt={promo.title}
                        loading="lazy"
                        className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-105 opacity-80 group-hover:opacity-90"
                        onError={(e) => {
                          // Gracefully hide broken image and display brand gradient
                          (e.target as HTMLElement).style.display = 'none';
                        }}
                      />
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/40 to-transparent" />
                    <div className="absolute bottom-2 left-2.5 right-2 text-white">
                      <span className="block text-[12px] font-black uppercase tracking-wider text-white drop-shadow-xs truncate">
                        {promo.title}
                      </span>
                      {promo.subtitle && (
                        <span className="text-[10px] text-[#E5E0D5] line-clamp-1">
                          {promo.subtitle}
                        </span>
                      )}
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>

          {/* COLUMN 2 (Right): Sub-Menu Items for the Hovered Category */}
          <div className="flex-1 p-5 pl-6 bg-white flex flex-col justify-between">
            <div>
              {/* Header for Active Group */}
              <div className="flex items-center justify-between pb-2 mb-3 border-b border-[#F0ECE3]">
                <h3 className="text-xs font-bold uppercase tracking-wider text-[#163A2B] flex items-center gap-1.5">
                  <span>{activeGroup?.label}</span>
                  {activeGroup?.isDanger && (
                    <span className="bg-red-100 text-red-700 text-[9px] px-1.5 py-0.2 rounded font-bold">
                      SALE
                    </span>
                  )}
                </h3>
                <Link
                  href={activeGroup?.href || `/category/${navItem.id}`}
                  onClick={onClose}
                  className="text-[11px] font-semibold text-[#163A2B] hover:text-[#214D3A] flex items-center gap-1 group"
                >
                  <span>View All</span>
                  <ArrowRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5" />
                </Link>
              </div>

              {/* Clean Single-Column Vertical List of Sub-Items */}
              <ul className="space-y-1">
                {activeGroup?.items.map((item) => (
                  <li key={item.id}>
                    <Link
                      href={item.href}
                      onClick={onClose}
                      className="group flex items-center justify-between py-1.5 text-[13px] text-[#333833] hover:text-[#163A2B] hover:font-medium transition-all"
                    >
                      <span className="group-hover:translate-x-1 transition-transform inline-flex items-center gap-2">
                        {item.label}
                        {item.isNew && (
                          <span className="bg-[#163A2B]/10 text-[#163A2B] text-[9px] px-1.5 py-0.2 rounded font-bold uppercase tracking-wider">
                            New
                          </span>
                        )}
                        {item.badge && (
                          <span className="bg-red-50 text-red-600 text-[9px] px-1.5 py-0.2 rounded font-bold uppercase tracking-wider">
                            {item.badge}
                          </span>
                        )}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            {/* Bottom Link to Full Catalog */}
            <div className="pt-3 mt-4 border-t border-[#F0ECE3] flex items-center justify-between text-[11px] text-[#6B756D]">
              <Link
                href={activeGroup?.href || `/category/${navItem.id}`}
                onClick={onClose}
                className="font-semibold text-[#163A2B] hover:underline flex items-center gap-1"
              >
                <span>Browse all {activeGroup?.label || navItem.label}</span>
                <span>&rarr;</span>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
