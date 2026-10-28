'use client';

import * as React from 'react';
import Link from 'next/link';
import { Search, Heart, User, ShoppingBag, Menu } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { DEFAULT_NAV_ITEMS, type TopNavItem } from './nav-data';
import { StorefrontMegaMenu } from './storefront-mega-menu';
import { StorefrontMobileNav } from './storefront-mobile-nav';

interface StorefrontHeaderProps {
  cartCount?: number;
  wishlistCount?: number;
  searchQuery?: string;
  onSearchChange?: (query: string) => void;
  onCartClick?: () => void;
  onWishlistClick?: () => void;
  customNavItems?: TopNavItem[];
}

export function StorefrontHeader({
  cartCount = 0,
  wishlistCount = 0,
  searchQuery = '',
  onSearchChange,
  onCartClick,
  onWishlistClick,
  customNavItems,
}: StorefrontHeaderProps) {
  const navItems =
    customNavItems && customNavItems.length > 0
      ? customNavItems
      : DEFAULT_NAV_ITEMS;

  // Active mega menu tab (e.g. 'women', 'men') or null if closed
  const [activeNavId, setActiveNavId] = React.useState<string | null>(null);
  const [isMobileNavOpen, setIsMobileNavOpen] = React.useState<boolean>(false);
  const [localSearch, setLocalSearch] = React.useState<string>(searchQuery);
  const [headerHeight, setHeaderHeight] = React.useState<number>(100);

  const headerRef = React.useRef<HTMLElement | null>(null);
  const closeTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);

  // Measure dynamic header height for seamless backdrop placement
  React.useEffect(() => {
    if (headerRef.current) {
      setHeaderHeight(headerRef.current.offsetHeight);
    }
  }, []);

  const clearCloseTimeout = React.useCallback(() => {
    if (closeTimeoutRef.current) {
      clearTimeout(closeTimeoutRef.current);
      closeTimeoutRef.current = null;
    }
  }, []);

  const handleMouseEnterNav = (id: string) => {
    clearCloseTimeout();
    setActiveNavId(id);
  };

  const handleMouseLeaveNav = () => {
    clearCloseTimeout();
    closeTimeoutRef.current = setTimeout(() => {
      setActiveNavId(null);
    }, 200); // 200ms grace window prevents abrupt closing when moving between elements
  };

  const handleCloseMegaMenu = () => {
    clearCloseTimeout();
    setActiveNavId(null);
  };

  const handleSearchInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setLocalSearch(val);
    onSearchChange?.(val);
  };

  // Currently active nav item for the mega menu
  const activeNavItem = navItems.find((item) => item.id === activeNavId);

  return (
    <>
      <header
        ref={headerRef}
        className="sticky top-0 z-40 bg-white border-b border-[#E5E0D5]"
      >
        {/* 1. Top Announcement Bar */}
        <div className="bg-[#163A2B] px-4 py-2 text-center text-xs font-medium text-[#FAF7F0] tracking-wide">
          <span className="inline-block animate-pulse mr-1.5">✨</span>
          Free delivery across Bangladesh on orders over ৳ 2,000 | Direct-to-Consumer Quality
        </div>

        {/* 2. Main 3-Zone Navigation Header */}
        <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between gap-4">
            {/* ZONE 1 (Left): Top-Level Navigation Links (Gymshark title-case style) */}
            <div className="flex items-center gap-2 lg:gap-8">
              {/* Mobile Hamburger Menu Toggle */}
              <button
                type="button"
                onClick={() => setIsMobileNavOpen(true)}
                className="lg:hidden -ml-2 p-2 rounded-lg text-[#252A25] hover:bg-[#FAF9F6] transition-colors"
                aria-label="Open navigation menu"
              >
                <Menu className="h-6 w-6" />
              </button>

              {/* Desktop Category Navigation Tabs */}
              <nav
                className="hidden lg:flex items-center space-x-6"
                aria-label="Storefront primary navigation"
              >
                {navItems.map((item) => {
                  const isActive = activeNavId === item.id;
                  return (
                    <div
                      key={item.id}
                      onMouseEnter={() => handleMouseEnterNav(item.id)}
                      onMouseLeave={handleMouseLeaveNav}
                      className="relative py-5"
                    >
                      <Link
                        href={item.href}
                        className={`text-sm font-bold tracking-wide transition-colors inline-flex items-center gap-1 ${
                          isActive
                            ? 'text-[#163A2B]'
                            : 'text-[#252A25] hover:text-[#163A2B]'
                        }`}
                      >
                        {item.label}
                      </Link>
                      {/* Clean Active Underline Indicator */}
                      <span
                        className={`absolute bottom-0 left-0 right-0 h-0.5 bg-[#163A2B] transition-transform duration-200 ${
                          isActive ? 'scale-x-100' : 'scale-x-0'
                        }`}
                      />
                    </div>
                  );
                })}
              </nav>
            </div>

            {/* ZONE 2 (Center): Brand Logo (Bold Gymshark-style center brand) */}
            <div className="absolute left-1/2 -translate-x-1/2 flex items-center justify-center">
              <Link
                href="/"
                onClick={handleCloseMegaMenu}
                className="flex items-center gap-2 group"
                aria-label="Open-Mart Home"
              >
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#163A2B] text-white font-extrabold text-xs shadow-xs group-hover:bg-[#214D3A] transition-colors">
                  OM
                </div>
                <span className="text-xl font-black tracking-tight text-[#163A2B] uppercase">
                  OPEN-MART
                </span>
              </Link>
            </div>

            {/* ZONE 3 (Right): Search, Wishlist, Account, Shopping Bag */}
            <div className="flex items-center gap-2 sm:gap-3">
              {/* Rounded Capsule Search Bar */}
              <div className="hidden md:block w-56 lg:w-72">
                <Input
                  placeholder="What are you looking for?"
                  value={localSearch}
                  onChange={handleSearchInputChange}
                  leftIcon={<Search className="h-4 w-4 text-[#6B756D]" />}
                  className="h-9 bg-[#F4F2EE] border-transparent hover:border-[#E5E0D5] focus:bg-white text-xs rounded-full transition-all"
                />
              </div>

              {/* Wishlist Button */}
              <button
                type="button"
                onClick={onWishlistClick}
                className="relative flex h-9 w-9 items-center justify-center rounded-full text-[#252A25] hover:bg-[#F4F2EE] hover:text-[#163A2B] transition-colors"
                aria-label="View wishlist"
              >
                <Heart className="h-5 w-5" />
                {wishlistCount > 0 && (
                  <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-600 text-[9px] font-bold text-white shadow-xs">
                    {wishlistCount}
                  </span>
                )}
              </button>

              {/* User Account / Profile */}
              <Link
                href="/admin"
                className="flex h-9 w-9 items-center justify-center rounded-full text-[#252A25] hover:bg-[#F4F2EE] hover:text-[#163A2B] transition-colors"
                aria-label="My Account"
              >
                <User className="h-5 w-5" />
              </Link>

              {/* Shopping Bag Button with Badge */}
              <button
                type="button"
                onClick={onCartClick}
                className="relative flex h-9 w-9 items-center justify-center rounded-full text-[#252A25] hover:bg-[#F4F2EE] hover:text-[#163A2B] transition-colors"
                aria-label="View shopping bag"
              >
                <ShoppingBag className="h-5 w-5" />
                {cartCount > 0 && (
                  <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-[#163A2B] text-[9px] font-bold text-white shadow-xs">
                    {cartCount}
                  </span>
                )}
              </button>
            </div>
          </div>

          {/* 3. Mega Menu Split Flyout (Anchored under nav items) */}
          {activeNavItem && (
            <StorefrontMegaMenu
              navItem={activeNavItem}
              isOpen={Boolean(activeNavId)}
              headerHeight={headerHeight}
              onClose={handleCloseMegaMenu}
              onMouseEnter={clearCloseTimeout}
              onMouseLeave={handleMouseLeaveNav}
            />
          )}
        </div>
      </header>

      {/* 4. Responsive Mobile Slide-Over Navigation */}
      <StorefrontMobileNav
        navItems={navItems}
        isOpen={isMobileNavOpen}
        onClose={() => setIsMobileNavOpen(false)}
        cartCount={cartCount}
        wishlistCount={wishlistCount}
      />
    </>
  );
}
