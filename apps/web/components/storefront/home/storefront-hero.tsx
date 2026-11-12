'use client';

import * as React from 'react';
import Link from 'next/link';
import {
  ArrowRight,
  Award,
  Car,
  ChevronLeft,
  ChevronRight,
  Cpu,
  Headphones,
  Home,
  Laptop,
  Layers,
  Palette,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Tag,
  Truck,
} from 'lucide-react';
import { useStorefrontCategories } from '@/hooks/storefront/use-storefront-categories';

interface HeroSlide {
  id: string;
  badge: string;
  title: string;
  subtitle: string;
  ctaLabel: string;
  ctaHref: string;
  secondaryLabel: string;
  secondaryHref: string;
  icon: React.ComponentType<{ className?: string }>;
  highlightStat: string;
  highlightLabel: string;
}

const HERO_SLIDES: HeroSlide[] = [
  {
    id: 'computers-workstations',
    badge: 'Flagship Computing',
    title: 'Pro Laptops, Monitors & Custom Workstation Builds',
    subtitle:
      'Discover creator-grade laptops, high-refresh displays, NVMe storage, and peripherals curated directly by OpenMart.',
    ctaLabel: 'Shop Computers',
    ctaHref: '/category/computers',
    secondaryLabel: "Today's Deals",
    secondaryHref: '/deals',
    icon: Laptop,
    highlightStat: 'Official Warranty',
    highlightLabel: 'Authorized hardware & accessories',
  },
  {
    id: 'electronics-audio',
    badge: 'Hi-Fi & Visuals',
    title: '4K Smart TVs, Studio Audio & Everyday Electronics',
    subtitle:
      'Upgrade your living room and daily carry with OLED displays, noise-canceling headphones, and fast GaN power gear.',
    ctaLabel: 'Shop Electronics',
    ctaHref: '/category/electronics',
    secondaryLabel: 'New Arrivals',
    secondaryHref: '/new-arrivals',
    icon: Cpu,
    highlightStat: 'Same-Day Dispatch',
    highlightLabel: 'Ready-to-ship in-stock gear',
  },
  {
    id: 'smart-home-security',
    badge: 'Connected Living',
    title: 'Automate Security, Lighting & Climate With Ease',
    subtitle:
      'Smart locks, indoor & outdoor cameras, LED lighting, and energy-saving thermostats built to work together.',
    ctaLabel: 'Shop Smart Home',
    ctaHref: '/category/smart-home',
    secondaryLabel: 'Best Sellers',
    secondaryHref: '/best-sellers',
    icon: Home,
    highlightStat: 'Smart Setup',
    highlightLabel: 'App & voice assistant ready',
  },
  {
    id: 'creative-auto',
    badge: 'Studio & Garage',
    title: 'Creative Arts Studio & Essential Automotive Tech',
    subtitle:
      'From fine paints and DIY craft kits to 4K dash cams, tire inflators, and garage maintenance tools.',
    ctaLabel: 'Explore Arts & Crafts',
    ctaHref: '/category/arts-and-crafts',
    secondaryLabel: 'Shop Automotive',
    secondaryHref: '/category/automotive',
    icon: Sparkles,
    highlightStat: 'Direct Storefront',
    highlightLabel: 'Single-merchant quality guarantee',
  },
];

const SERVICE_HIGHLIGHTS = [
  {
    title: 'Fast Nationwide Delivery',
    description: 'Tracked doorstep shipping from our central warehouse',
    icon: Truck,
  },
  {
    title: '100% Authentic Products',
    description: 'Verified stock directly sourced & quality checked',
    icon: ShieldCheck,
  },
  {
    title: 'Official Brand Warranty',
    description: 'Transparent coverage & smooth service support',
    icon: Award,
  },
  {
    title: 'Easy Returns & Support',
    description: 'Dedicated merchant assistance for every order',
    icon: Headphones,
  },
];

function getDepartmentIcon(slug: string) {
  const normalized = slug.toLowerCase();
  if (normalized.includes('computer')) return Laptop;
  if (normalized.includes('electronic')) return Cpu;
  if (normalized.includes('smart') || normalized.includes('home')) return Home;
  if (normalized.includes('art') || normalized.includes('craft'))
    return Palette;
  if (normalized.includes('auto')) return Car;
  return Layers;
}

/**
 * Ryans.com-inspired storefront hero section:
 * Left quick department menu, center interactive campaign slider,
 * right stacked promo/trust cards, plus service highlights & featured departments.
 */
export function StorefrontHero() {
  const [activeSlide, setActiveSlide] = React.useState(0);
  const [isPaused, setIsPaused] = React.useState(false);
  const { departments, isLoading } = useStorefrontCategories();

  React.useEffect(() => {
    if (isPaused) return;
    const timer = setInterval(() => {
      setActiveSlide((prev) => (prev + 1) % HERO_SLIDES.length);
    }, 5500);
    return () => clearInterval(timer);
  }, [isPaused]);

  const currentSlide = HERO_SLIDES[activeSlide];
  const SlideIcon = currentSlide.icon;

  const handlePrev = () => {
    setActiveSlide(
      (prev) => (prev - 1 + HERO_SLIDES.length) % HERO_SLIDES.length,
    );
  };

  const handleNext = () => {
    setActiveSlide((prev) => (prev + 1) % HERO_SLIDES.length);
  };

  return (
    <section className="space-y-6">
      {/* Main 3-Zone Ryans-style Hero Grid */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        {/* LEFT COLUMN: Quick Department Menu Card (Desktop) */}
        <aside className="hidden overflow-hidden rounded-xl border border-[#E5E0D5] bg-white shadow-xs lg:col-span-3 lg:flex lg:flex-col">
          <div className="flex items-center justify-between bg-[#163A2B] px-4 py-3 text-[#FAF7F0]">
            <h2 className="text-sm font-bold tracking-tight">
              Shop by Department
            </h2>
            <span className="rounded-full bg-[#2F855A] px-2 py-0.5 text-[11px] font-bold text-white">
              {departments.length}
            </span>
          </div>

          <div className="flex-1 divide-y divide-[#E5E0D5]/60">
            {isLoading ? (
              <div className="space-y-2.5 p-4">
                {[1, 2, 3, 4, 5].map((row) => (
                  <div
                    key={row}
                    className="h-9 animate-pulse rounded-lg bg-[#F4F2EE]"
                  />
                ))}
              </div>
            ) : (
              departments.slice(0, 7).map((dept) => {
                const DeptIcon = getDepartmentIcon(dept.slug);
                return (
                  <Link
                    key={dept.id}
                    href={dept.href}
                    className="group flex items-center justify-between px-4 py-3 text-sm font-medium text-[#252A25] transition-colors hover:bg-[#F4F2EE] hover:text-[#163A2B]"
                  >
                    <span className="flex min-w-0 items-center gap-3">
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#F4F2EE] text-[#163A2B] transition-colors group-hover:bg-[#163A2B] group-hover:text-white">
                        <DeptIcon className="h-4 w-4" />
                      </span>
                      <span className="truncate">{dept.name}</span>
                    </span>
                    <ChevronRight className="h-4 w-4 shrink-0 text-[#6B756D] transition-transform group-hover:translate-x-0.5 group-hover:text-[#163A2B]" />
                  </Link>
                );
              })
            )}
          </div>

          <div className="flex items-center justify-between border-t border-[#E5E0D5] bg-[#FAF7F0] px-4 py-2.5 text-xs font-semibold">
            <Link
              href="/deals"
              className="text-[#163A2B] transition-colors hover:text-[#2F855A]"
            >
              Today&apos;s Deals
            </Link>
            <Link
              href="/new-arrivals"
              className="inline-flex items-center gap-1 text-[#6B756D] transition-colors hover:text-[#163A2B]"
            >
              New Arrivals
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </aside>

        {/* CENTER COLUMN: Interactive Promotional Slider */}
        <div
          onMouseEnter={() => setIsPaused(true)}
          onMouseLeave={() => setIsPaused(false)}
          className="relative flex min-h-[320px] flex-col justify-between overflow-hidden rounded-xl border border-[#214D3A]/30 bg-gradient-to-br from-[#163A2B] via-[#122E22] to-[#0D2118] p-6 text-[#FAF7F0] shadow-sm sm:min-h-[360px] sm:p-8 lg:col-span-6"
        >
          {/* Decorative background glow */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -top-24 -right-24 h-72 w-72 rounded-full bg-[#2F855A]/25 blur-3xl"
          />

          <div className="relative z-10 grid grid-cols-1 items-center gap-6 sm:grid-cols-12">
            {/* Slide Copy */}
            <div className="space-y-4 sm:col-span-8">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-[#2F855A] px-3 py-1 text-xs font-bold tracking-wide text-white uppercase">
                <Tag className="h-3.5 w-3.5" />
                {currentSlide.badge}
              </span>

              <h1 className="text-2xl leading-tight font-bold tracking-tight text-white sm:text-3xl xl:text-[34px]">
                {currentSlide.title}
              </h1>

              <p className="max-w-xl text-sm leading-relaxed text-[#E8DFD0]/90 sm:text-[15px]">
                {currentSlide.subtitle}
              </p>

              <div className="flex flex-wrap items-center gap-3 pt-1">
                <Link
                  href={currentSlide.ctaHref}
                  className="inline-flex items-center gap-2 rounded-lg bg-white px-5 py-2.5 text-sm font-bold text-[#163A2B] shadow-xs transition-colors hover:bg-[#FAF7F0]"
                >
                  <span>{currentSlide.ctaLabel}</span>
                  <ArrowRight className="h-4 w-4" />
                </Link>
                <Link
                  href={currentSlide.secondaryHref}
                  className="inline-flex items-center gap-2 rounded-lg border border-[#E8DFD0]/40 bg-white/5 px-4 py-2.5 text-sm font-semibold text-[#FAF7F0] transition-colors hover:bg-white/15"
                >
                  {currentSlide.secondaryLabel}
                </Link>
              </div>
            </div>

            {/* Right Visual Feature Motif */}
            <div className="hidden sm:col-span-4 sm:flex sm:flex-col sm:items-center sm:justify-center">
              <div className="flex h-36 w-36 items-center justify-center rounded-2xl border border-white/15 bg-white/10 shadow-inner backdrop-blur-xs">
                <SlideIcon className="h-16 w-16 text-[#FAF7F0]" />
              </div>
              <div className="mt-3 rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-center">
                <p className="text-xs font-bold text-white">
                  {currentSlide.highlightStat}
                </p>
                <p className="text-[11px] text-[#E8DFD0]/80">
                  {currentSlide.highlightLabel}
                </p>
              </div>
            </div>
          </div>

          {/* Bottom Controls: Dots + Arrows */}
          <div className="relative z-10 mt-6 flex items-center justify-between pt-2">
            <div
              className="flex items-center gap-2"
              role="tablist"
              aria-label="Hero slides"
            >
              {HERO_SLIDES.map((slide, idx) => (
                <button
                  key={slide.id}
                  type="button"
                  role="tab"
                  aria-selected={idx === activeSlide}
                  aria-label={`Show slide ${idx + 1}: ${slide.badge}`}
                  onClick={() => setActiveSlide(idx)}
                  className={`h-2 cursor-pointer rounded-full transition-all ${
                    idx === activeSlide
                      ? 'w-7 bg-[#2F855A]'
                      : 'w-2 bg-white/35 hover:bg-white/60'
                  }`}
                />
              ))}
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handlePrev}
                aria-label="Previous slide"
                className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-full border border-white/20 bg-white/10 text-white transition-colors hover:bg-white/20"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={handleNext}
                aria-label="Next slide"
                className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-full border border-white/20 bg-white/10 text-white transition-colors hover:bg-white/20"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: Two Stacked Side Promo & Utility Cards */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:col-span-3 lg:grid-cols-1">
          {/* Card 1: Flash Offer Card */}
          <div className="flex flex-col justify-between rounded-xl border border-[#214D3A] bg-[#122E22] p-5 text-[#FAF7F0] shadow-xs">
            <div>
              <span className="inline-flex items-center gap-1 rounded-full bg-[#2F855A] px-2.5 py-0.5 text-[11px] font-bold tracking-wide text-white uppercase">
                Limited Deals
              </span>
              <h2 className="mt-3 text-lg font-bold tracking-tight text-white">
                Save on Smart Home &amp; Audio Combos
              </h2>
              <p className="mt-1.5 text-sm leading-relaxed text-[#E8DFD0]/85">
                Hand-picked weekly bundles with instant checkout savings.
              </p>
            </div>

            <Link
              href="/deals"
              className="mt-4 inline-flex items-center justify-between rounded-lg bg-[#214D3A] px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#2F855A]"
            >
              <span>Browse Hot Deals</span>
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>

          {/* Card 2: Quick Orders & Storefront Assurance */}
          <div className="flex flex-col justify-between rounded-xl border border-[#E5E0D5] bg-white p-5 shadow-xs">
            <div>
              <div className="flex items-center gap-2 text-[#163A2B]">
                <RefreshCw className="h-4 w-4 text-[#2F855A]" />
                <span className="text-xs font-bold tracking-wider uppercase">
                  Direct Merchant Care
                </span>
              </div>
              <h2 className="mt-2 text-lg font-bold tracking-tight text-[#252A25]">
                Verified Stock &amp; Fast Order Tracking
              </h2>
              <p className="mt-1.5 text-sm leading-relaxed text-[#6B756D]">
                Every order ships straight from OpenMart with live fulfillment
                updates.
              </p>
            </div>

            <div className="mt-4 flex items-center gap-2">
              <Link
                href="/orders"
                className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-[#163A2B] px-3.5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#214D3A]"
              >
                <span>Track Orders</span>
              </Link>
              <Link
                href="/best-sellers"
                className="inline-flex items-center justify-center rounded-lg border border-[#E5E0D5] bg-[#FAF7F0] px-3.5 py-2.5 text-sm font-semibold text-[#163A2B] transition-colors hover:bg-[#E8DFD0]"
              >
                Top Picks
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Service Highlights Strip (Ryans-inspired trust bar) */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {SERVICE_HIGHLIGHTS.map((item) => {
          const ItemIcon = item.icon;
          return (
            <div
              key={item.title}
              className="flex items-center gap-3.5 rounded-xl border border-[#E5E0D5] bg-white px-4 py-3.5 shadow-xs"
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#163A2B]/10 text-[#163A2B]">
                <ItemIcon className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <h3 className="truncate text-sm font-bold text-[#252A25]">
                  {item.title}
                </h3>
                <p className="truncate text-xs text-[#6B756D]">
                  {item.description}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Featured Departments Grid (Live from GET /api/categories/tree) */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold tracking-tight text-[#163A2B]">
              Featured Departments
            </h2>
            <p className="text-sm text-[#6B756D]">
              Jump directly into our core product categories
            </p>
          </div>
          <Link
            href="/deals"
            className="inline-flex items-center gap-1 text-sm font-semibold text-[#163A2B] hover:text-[#2F855A]"
          >
            <span>View All Offers</span>
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        <div className="grid grid-cols-2 gap-3.5 sm:grid-cols-3 lg:grid-cols-5">
          {departments.map((dept) => {
            const DeptIcon = getDepartmentIcon(dept.slug);
            return (
              <Link
                key={dept.id}
                href={dept.href}
                className="group flex flex-col justify-between rounded-xl border border-[#E5E0D5] bg-white p-4 shadow-xs transition-all hover:border-[#163A2B]/40 hover:shadow-md"
              >
                <div className="flex items-center justify-between">
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#F4F2EE] text-[#163A2B] transition-colors group-hover:bg-[#163A2B] group-hover:text-white">
                    <DeptIcon className="h-5 w-5" />
                  </div>
                  <ArrowRight className="h-4 w-4 text-[#6B756D] transition-transform group-hover:translate-x-0.5 group-hover:text-[#163A2B]" />
                </div>

                <div className="mt-4">
                  <h3 className="text-base font-bold text-[#252A25] group-hover:text-[#163A2B]">
                    {dept.name}
                  </h3>
                  <p className="mt-1 line-clamp-2 text-xs text-[#6B756D]">
                    {dept.description || `Explore ${dept.name} essentials`}
                  </p>
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
}
