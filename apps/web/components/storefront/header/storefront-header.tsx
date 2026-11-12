'use client';

import * as React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import {
  ChevronDown,
  Loader2,
  MapPin,
  Package,
  Search,
  ShoppingCart,
  User,
  X,
} from 'lucide-react';
import { useStorefrontCategories } from '@/hooks/storefront/use-storefront-categories';
import { useStorefrontProducts } from '@/hooks/storefront/use-storefront-products';
import { formatBDT } from '@/lib/utils';
import { SECONDARY_QUICK_LINKS } from './nav-data';
import { StorefrontHamburgerDrawer } from './storefront-hamburger-drawer';

export interface StorefrontHeaderProps {
  cartCount?: number;
  customerName?: string | null;
  deliveryLocation?: string;
}

/**
 * Amazon-inspired two-tier storefront navigation styled with the
 * Admin Dashboard color palette (#163A2B, #122E22, #214D3A, #2F855A, #FAF7F0).
 */
export function StorefrontHeader({
  cartCount = 0,
  customerName = null,
  deliveryLocation = 'Bangladesh',
}: StorefrontHeaderProps) {
  const router = useRouter();
  const [searchScope, setSearchScope] = React.useState<string>('all');
  const [searchQuery, setSearchQuery] = React.useState<string>('');
  const [debouncedQuery, setDebouncedQuery] = React.useState<string>('');
  const [isSuggestionsOpen, setIsSuggestionsOpen] = React.useState(false);
  const searchBoxRef = React.useRef<HTMLDivElement>(null);
  const { departments, isLoading } = useStorefrontCategories();

  React.useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(searchQuery.trim());
    }, 220);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  React.useEffect(() => {
    const handleOutsideClick = (event: MouseEvent) => {
      if (
        searchBoxRef.current &&
        !searchBoxRef.current.contains(event.target as Node)
      ) {
        setIsSuggestionsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  const { data: suggestionsData, isFetching: isSearchingSuggestions } =
    useStorefrontProducts({
      search: debouncedQuery,
      category: searchScope,
      page: 1,
      limit: 6,
      enabled: debouncedQuery.length >= 2,
    });

  const suggestions = suggestionsData?.data ?? [];

  const handleSearchSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSuggestionsOpen(false);
    const trimmed = searchQuery.trim();
    const params = new URLSearchParams();
    if (trimmed) {
      params.set('q', trimmed);
    }
    if (searchScope !== 'all') {
      params.set('category', searchScope);
    }
    const queryString = params.toString();
    router.push(queryString ? `/search?${queryString}` : '/search');
  };

  const selectedScopeLabel =
    searchScope === 'all'
      ? 'All'
      : (departments.find((cat) => cat.slug === searchScope)?.name ?? 'All');

  return (
    <header className="sticky top-0 z-40 w-full font-sans select-none">
      {/* TIER 1: Primary Top Navigation Bar (#163A2B) */}
      <div className="bg-[#163A2B] text-[#FAF7F0]">
        <div className="mx-auto flex max-w-[1900px] flex-wrap items-center gap-2.5 px-3 py-2.5 sm:px-4 md:flex-nowrap md:gap-4">
          {/* Mobile Left: Hamburger Drawer */}
          <div className="flex items-center md:hidden">
            <StorefrontHamburgerDrawer compactMobileTrigger />
          </div>

          {/* Brand Logo + Wordmark */}
          <Link
            href="/"
            aria-label="OpenMart Home"
            className="flex shrink-0 items-center gap-2.5 rounded-sm border border-transparent px-2 py-1 transition-colors hover:border-[#E8DFD0]/60 hover:bg-[#214D3A]/60"
          >
            <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-md bg-white ring-1 ring-[#E8DFD0]/40">
              <Image
                src="/logo.jpg"
                alt="OpenMart Logo"
                fill
                sizes="40px"
                priority
                className="object-cover"
              />
            </div>
            <div className="flex flex-col leading-none">
              <span className="text-lg font-bold tracking-tight text-white sm:text-xl">
                OpenMart
              </span>
              <span className="mt-0.5 text-[11px] font-medium tracking-wider text-[#E8DFD0]/85 uppercase">
                Storefront
              </span>
            </div>
          </Link>

          {/* Amazon-style Delivery Location Slot (Desktop) */}
          <button
            type="button"
            className="hidden shrink-0 cursor-pointer items-center gap-1.5 rounded-sm border border-transparent px-2.5 py-1 text-left transition-colors hover:border-[#E8DFD0]/60 hover:bg-[#214D3A]/60 lg:flex"
            aria-label={`Deliver to ${deliveryLocation}`}
          >
            <MapPin className="mt-1.5 h-4 w-4 shrink-0 text-[#E8DFD0]" />
            <span className="flex flex-col leading-tight">
              <span className="text-xs font-normal text-[#E8DFD0]/85">
                Deliver to
              </span>
              <span className="text-sm font-bold text-white">
                {deliveryLocation}
              </span>
            </span>
          </button>

          {/* Scoped Search Bar + Live Trigram/Banglish Autocomplete */}
          <div
            ref={searchBoxRef}
            className="order-last relative mt-1 w-full md:order-none md:mt-0 md:flex-1"
          >
            <form
              onSubmit={handleSearchSubmit}
              className="flex h-11 w-full items-stretch overflow-hidden rounded-md bg-white ring-1 ring-[#E5E0D5]/30 focus-within:ring-2 focus-within:ring-[#2F855A]"
              role="search"
              aria-label="Search store catalog"
            >
              {/* Department Scope Selector */}
              <div className="relative hidden shrink-0 sm:flex">
                <select
                  aria-label="Search department"
                  value={searchScope}
                  onChange={(e) => setSearchScope(e.target.value)}
                  className="h-full cursor-pointer appearance-none border-r border-[#E5E0D5] bg-[#F4F2EE] pr-8 pl-3.5 text-[13px] font-semibold text-[#252A25] transition-colors hover:bg-[#E8DFD0] focus:outline-none"
                >
                  <option value="all">All</option>
                  {departments.map((category) => (
                    <option key={category.id} value={category.slug}>
                      {category.name}
                    </option>
                  ))}
                </select>
                <ChevronDown className="pointer-events-none absolute top-1/2 right-2.5 h-4 w-4 -translate-y-1/2 text-[#6B756D]" />
              </div>

              {/* Search Input */}
              <div className="relative flex flex-1 items-center">
                <input
                  type="search"
                  value={searchQuery}
                  onFocus={() => setIsSuggestionsOpen(true)}
                  onKeyDown={(e) => {
                    if (e.key === 'Escape') {
                      setIsSuggestionsOpen(false);
                    }
                  }}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setIsSuggestionsOpen(true);
                  }}
                  placeholder={
                    searchScope === 'all'
                      ? 'Search OpenMart (English, Banglish or বাংলা)...'
                      : `Search ${selectedScopeLabel}...`
                  }
                  aria-label="Search products"
                  className="h-full w-full bg-white px-3.5 text-[15px] text-[#252A25] placeholder:text-[#6B756D] focus:outline-none"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => {
                      setSearchQuery('');
                      setDebouncedQuery('');
                      setIsSuggestionsOpen(false);
                    }}
                    aria-label="Clear search query"
                    className="mr-2 flex h-7 w-7 cursor-pointer items-center justify-center rounded-full text-[#6B756D] hover:bg-[#F4F2EE] hover:text-[#252A25]"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>

              {/* Search Submit Button (#2F855A admin secondary accent) */}
              <button
                type="submit"
                aria-label="Submit search"
                className="flex w-12 shrink-0 cursor-pointer items-center justify-center bg-[#2F855A] text-white transition-colors hover:bg-[#214D3A]"
              >
                <Search className="h-5 w-5" />
              </button>
            </form>

            {isSuggestionsOpen && debouncedQuery.length >= 2 && (
              <div className="absolute top-full right-0 left-0 z-50 mt-1.5 overflow-hidden rounded-xl border border-[#E5E0D5] bg-white text-[#252A25] shadow-xl">
                {isSearchingSuggestions && suggestions.length === 0 ? (
                  <div className="flex items-center gap-2 px-4 py-3 text-xs text-[#6B756D]">
                    <Loader2 className="h-4 w-4 animate-spin text-[#163A2B]" />
                    <span>Searching catalog...</span>
                  </div>
                ) : suggestions.length === 0 ? (
                  <div className="px-4 py-3 text-xs text-[#6B756D]">
                    No instant matches for &ldquo;{debouncedQuery}&rdquo;. Press
                    Enter to view full search.
                  </div>
                ) : (
                  <div className="divide-y divide-[#E5E0D5]/60">
                    {suggestions.map((item) => {
                      const thumb =
                        item.media.find((m) => m.isThumbnail)?.url ??
                        item.media[0]?.url;
                      return (
                        <Link
                          key={item.id}
                          href={`/products/${item.id}`}
                          onClick={() => setIsSuggestionsOpen(false)}
                          className="flex items-center justify-between gap-3 px-4 py-2.5 transition-colors hover:bg-[#FAF7F0]"
                        >
                          <div className="flex min-w-0 items-center gap-3">
                            <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-[#E5E0D5] bg-[#F4F2EE]">
                              {thumb ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img
                                  src={thumb}
                                  alt={item.title}
                                  className="h-full w-full object-cover"
                                />
                              ) : (
                                <Package className="h-4 w-4 text-[#6B756D]" />
                              )}
                            </div>
                            <div className="min-w-0">
                              <p className="truncate text-sm font-semibold text-[#252A25]">
                                {item.title}
                              </p>
                              <p className="truncate text-xs text-[#6B756D]">
                                {item.category?.name || item.sku}
                              </p>
                            </div>
                          </div>
                          <span className="shrink-0 text-sm font-bold text-[#163A2B]">
                            {formatBDT(item.unitPrice)}
                          </span>
                        </Link>
                      );
                    })}
                    <Link
                      href={`/search?${new URLSearchParams({
                        q: debouncedQuery,
                        ...(searchScope !== 'all'
                          ? { category: searchScope }
                          : {}),
                      }).toString()}`}
                      onClick={() => setIsSuggestionsOpen(false)}
                      className="flex items-center justify-between bg-[#FAF7F0] px-4 py-2.5 text-xs font-bold text-[#163A2B] hover:bg-[#E8DFD0]/50"
                    >
                      <span>
                        See all results for &ldquo;{debouncedQuery}&rdquo;
                      </span>
                      <span>→</span>
                    </Link>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Right Utility Actions */}
          <div className="ml-auto flex shrink-0 items-center gap-1 sm:gap-2 md:ml-0">
            {/* Account / Sign in */}
            <Link
              href={customerName ? '/account' : '/login'}
              className="flex items-center gap-1.5 rounded-sm border border-transparent px-2.5 py-1 transition-colors hover:border-[#E8DFD0]/60 hover:bg-[#214D3A]/60"
            >
              <User className="h-4 w-4 text-[#E8DFD0] md:hidden" />
              <div className="flex flex-col leading-tight">
                <span className="hidden text-xs font-normal text-[#E8DFD0]/85 md:block">
                  {customerName ? `Hello, ${customerName}` : 'Hello, sign in'}
                </span>
                <span className="flex items-center gap-1 text-sm font-bold text-white">
                  <span className="hidden md:inline">Account &amp; Lists</span>
                  <span className="md:hidden">Sign in</span>
                  <ChevronDown className="hidden h-3.5 w-3.5 text-[#E8DFD0]/80 md:inline" />
                </span>
              </div>
            </Link>

            {/* Returns & Orders */}
            <Link
              href="/orders"
              className="hidden flex-col rounded-sm border border-transparent px-2.5 py-1 leading-tight transition-colors hover:border-[#E8DFD0]/60 hover:bg-[#214D3A]/60 sm:flex"
            >
              <span className="text-xs font-normal text-[#E8DFD0]/85">
                Returns
              </span>
              <span className="text-sm font-bold text-white">&amp; Orders</span>
            </Link>

            {/* Shopping Cart */}
            <Link
              href="/cart"
              aria-label={`Shopping cart with ${cartCount} items`}
              className="flex items-end gap-2 rounded-sm border border-transparent px-2.5 py-1 transition-colors hover:border-[#E8DFD0]/60 hover:bg-[#214D3A]/60"
            >
              <div className="relative flex items-center justify-center">
                <ShoppingCart className="h-6 w-6 text-white" />
                <span className="absolute -top-2 -right-2.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-[#2F855A] px-1 text-xs font-bold text-white ring-2 ring-[#163A2B]">
                  {cartCount > 99 ? '99+' : cartCount}
                </span>
              </div>
              <span className="hidden pb-0.5 text-sm font-bold text-white sm:inline">
                Cart
              </span>
            </Link>
          </div>
        </div>
      </div>

      {/* TIER 2: Secondary Department Navigation Bar (#122E22) */}
      <nav
        aria-label="Store departments"
        className="border-t border-[#214D3A]/70 bg-[#122E22] text-[#FAF7F0]"
      >
        <div className="mx-auto flex max-w-[1900px] items-center gap-1.5 overflow-x-auto px-3 py-1.5 sm:px-4">
          {/* Desktop "All" Hamburger Drawer Trigger */}
          <div className="hidden shrink-0 md:block">
            <StorefrontHamburgerDrawer triggerLabel="All" />
          </div>

          {/* Primary Storefront Categories (Live from API) */}
          {isLoading ? (
            <div className="flex items-center gap-2 py-1">
              {[1, 2, 3, 4, 5].map((item) => (
                <div
                  key={item}
                  className="h-7 w-24 animate-pulse rounded-sm bg-[#214D3A]/60"
                />
              ))}
            </div>
          ) : (
            <ul className="flex items-center gap-1 sm:gap-1.5">
              {departments.map((category) => (
                <li key={category.id} className="shrink-0">
                  <Link
                    href={category.href}
                    className="inline-flex h-9 items-center rounded-sm border border-transparent px-3 text-[15px] font-medium whitespace-nowrap text-[#FAF7F0] transition-colors hover:border-[#E8DFD0]/60 hover:bg-[#214D3A]/70"
                  >
                    {category.name}
                  </Link>
                </li>
              ))}
            </ul>
          )}

          {/* Subtle Divider + Quick Storefront Links */}
          <span
            aria-hidden="true"
            className="mx-1.5 hidden h-4 w-px shrink-0 bg-[#214D3A] lg:inline-block"
          />

          <ul className="hidden items-center gap-1 lg:flex">
            {SECONDARY_QUICK_LINKS.map((link) => (
              <li key={link.label} className="shrink-0">
                <Link
                  href={link.href}
                  className="inline-flex h-9 items-center rounded-sm border border-transparent px-3 text-sm font-normal whitespace-nowrap text-[#E8DFD0] transition-colors hover:border-[#E8DFD0]/60 hover:bg-[#214D3A]/70 hover:text-white"
                >
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </nav>
    </header>
  );
}
