'use client';

import * as React from 'react';
import Image from 'next/image';
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
  image: string;
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
    image: '/banner-one.webp',
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
    image: '/banner-three.webp',
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
    image: '/banner-two.webp',
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
    image: '/banner-creative-auto.webp',
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
 * Modern High-Impact Storefront Hero Section:
 * - Wide layout (max-w-[1900px])
 * - Cinematic background photography slider with dark green contrast gradients
 * - Expanded promotional cards with rich imagery (including Smart Home & Audio Deals)
 * - Service highlights trust bar & live category showcase
 */
export function StorefrontHero() {
  const [activeSlide, setActiveSlide] = React.useState(0);
  const [isPaused, setIsPaused] = React.useState(false);
  const { departments } = useStorefrontCategories();

  React.useEffect(() => {
    if (isPaused) return;
    const timer = setInterval(() => {
      setActiveSlide((prev) => (prev + 1) % HERO_SLIDES.length);
    }, 6000);
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
    <section className="mx-auto w-full max-w-[1900px] space-y-6 sm:space-y-8">
      {/* Main Hero Showcase Grid: Large Banner Slider (left/center) + Stacked Feature Cards (right) */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12 lg:gap-6">
        {/* HERO SLIDER: Large cinematic banner with background imagery */}
        <div
          onMouseEnter={() => setIsPaused(true)}
          onMouseLeave={() => setIsPaused(false)}
          className="group relative flex min-h-[460px] flex-col justify-between overflow-hidden rounded-2xl border border-[#214D3A]/40 bg-[#071710] text-[#FAF7F0] shadow-md sm:min-h-[520px] lg:col-span-8 lg:min-h-[580px] xl:col-span-8 xl:min-h-[620px] 2xl:col-span-9"
        >
          {/* Background Image Carousel with Smooth Crossfade */}
          {HERO_SLIDES.map((slide, idx) => (
            <div
              key={slide.id}
              className={`absolute inset-0 transition-opacity duration-700 ease-in-out ${
                idx === activeSlide
                  ? 'opacity-100'
                  : 'pointer-events-none opacity-0'
              }`}
            >
              <Image
                src={slide.image}
                alt={slide.title}
                fill
                priority={idx === 0}
                sizes="(max-width: 1024px) 100vw, (max-width: 1536px) 70vw, 75vw"
                className="object-cover object-center transition-transform duration-1000 ease-out group-hover:scale-105"
              />
              {/* Premium Multi-layer Contrast Gradients */}
              <div
                aria-hidden="true"
                className="absolute inset-0 bg-gradient-to-r from-[#071710]/95 via-[#0b2419]/80 to-transparent sm:via-[#0b2419]/70 sm:to-black/30"
              />
              <div
                aria-hidden="true"
                className="absolute inset-0 bg-gradient-to-t from-[#071710]/90 via-transparent to-black/20"
              />
            </div>
          ))}

          {/* Top Row: Badge & Category Indicator */}
          <div className="relative z-10 flex items-center justify-between p-6 sm:p-8 md:p-10">
            <span className="inline-flex items-center gap-2 rounded-full border border-emerald-400/30 bg-[#2F855A]/40 px-3.5 py-1.5 text-xs font-bold tracking-wider text-emerald-200 uppercase backdrop-blur-md">
              <Tag className="h-3.5 w-3.5 text-emerald-300" />
              {currentSlide.badge}
            </span>

            {/* Slide Counter Indicator */}
            <span className="hidden rounded-full border border-white/15 bg-black/30 px-3 py-1 text-xs font-semibold text-white/90 backdrop-blur-md sm:inline-flex">
              {activeSlide + 1} / {HERO_SLIDES.length}
            </span>
          </div>

          {/* Center Copy Content */}
          <div className="relative z-10 grid grid-cols-1 items-end gap-6 p-6 sm:p-8 md:p-10 lg:grid-cols-12">
            <div className="space-y-4 sm:space-y-5 lg:col-span-8 xl:col-span-9">
              <h1 className="text-2xl font-black leading-tight tracking-tight text-white drop-shadow-sm sm:text-4xl md:text-5xl xl:text-5xl">
                {currentSlide.title}
              </h1>

              <p className="max-w-xl text-sm leading-relaxed text-[#E8DFD0]/95 sm:text-base md:text-lg">
                {currentSlide.subtitle}
              </p>

              {/* Action Buttons */}
              <div className="flex flex-wrap items-center gap-3 pt-2">
                <Link
                  href={currentSlide.ctaHref}
                  className="inline-flex items-center gap-2 rounded-xl bg-white px-6 py-3.5 text-sm font-bold text-[#163A2B] shadow-lg transition-all hover:-translate-y-0.5 hover:bg-[#FAF7F0] hover:shadow-xl active:translate-y-0"
                >
                  <span>{currentSlide.ctaLabel}</span>
                  <ArrowRight className="h-4 w-4" />
                </Link>
                <Link
                  href={currentSlide.secondaryHref}
                  className="inline-flex items-center gap-2 rounded-xl border border-[#E8DFD0]/40 bg-black/30 px-5 py-3.5 text-sm font-semibold text-[#FAF7F0] backdrop-blur-md transition-all hover:bg-white/20 hover:text-white"
                >
                  {currentSlide.secondaryLabel}
                </Link>
              </div>
            </div>

            {/* Quick Feature Stat Motif (Desktop) */}
            <div className="hidden lg:col-span-4 lg:flex lg:flex-col lg:items-end lg:justify-end xl:col-span-3">
              <div className="flex items-center gap-3 rounded-2xl border border-white/15 bg-black/40 p-4 shadow-lg backdrop-blur-md">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-white/10 text-emerald-300">
                  <SlideIcon className="h-6 w-6" />
                </div>
                <div className="text-left">
                  <p className="text-xs font-bold text-white">
                    {currentSlide.highlightStat}
                  </p>
                  <p className="text-[11px] text-[#E8DFD0]/80">
                    {currentSlide.highlightLabel}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Bottom Bar: Indicators & Slide Controls */}
          <div className="relative z-10 flex items-center justify-between border-t border-white/10 bg-black/25 px-6 py-4 backdrop-blur-md sm:px-8">
            {/* Dot & Pill Indicators */}
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
                  className={`cursor-pointer rounded-full transition-all duration-300 ${
                    idx === activeSlide
                      ? 'h-2.5 w-9 bg-[#2F855A] ring-2 ring-emerald-400/40'
                      : 'h-2.5 w-2.5 bg-white/40 hover:bg-white/70'
                  }`}
                />
              ))}
            </div>

            {/* Arrow Navigation */}
            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={handlePrev}
                aria-label="Previous slide"
                className="flex h-10 w-10 cursor-pointer items-center justify-center rounded-full border border-white/20 bg-white/10 text-white backdrop-blur-md transition-colors hover:bg-white/25 active:scale-95"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
              <button
                type="button"
                onClick={handleNext}
                aria-label="Next slide"
                className="flex h-10 w-10 cursor-pointer items-center justify-center rounded-full border border-white/20 bg-white/10 text-white backdrop-blur-md transition-colors hover:bg-white/25 active:scale-95"
              >
                <ChevronRight className="h-5 w-5" />
              </button>
            </div>
          </div>
        </div>

        {/* PROMOTIONAL SIDE CARDS (Right): Increased size, rich background imagery */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:col-span-4 lg:flex lg:flex-col lg:justify-between lg:gap-6 xl:col-span-4 2xl:col-span-3">
          {/* Card 1: Limited Deals - Smart Home & Audio Combos (Image 2 requested) */}
          <div className="group relative flex min-h-[220px] flex-1 flex-col justify-between overflow-hidden rounded-2xl border border-[#214D3A]/40 bg-[#071710] p-6 text-[#FAF7F0] shadow-md transition-all hover:border-emerald-500/50 hover:shadow-xl sm:min-h-[250px] lg:min-h-[275px] xl:min-h-[295px]">
            {/* Background Image: Smart Home & Audio Combos */}
            <Image
              src="/banner-smart-home-audio.webp"
              alt="Smart Home and Audio Deals"
              fill
              sizes="(max-width: 1024px) 100vw, 420px"
              className="object-cover object-right transition-transform duration-700 ease-out group-hover:scale-105"
            />
            {/* Contrast Gradient */}
            <div
              aria-hidden="true"
              className="absolute inset-0 bg-gradient-to-r from-[#071710]/95 via-[#0b2419]/85 to-transparent/40"
            />
            <div
              aria-hidden="true"
              className="absolute inset-0 bg-gradient-to-t from-[#071710]/90 via-transparent to-transparent"
            />

            {/* Content */}
            <div className="relative z-10">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-400/30 bg-[#2F855A]/50 px-3 py-1 text-[11px] font-bold tracking-wider text-emerald-200 uppercase backdrop-blur-md">
                Limited Deals
              </span>
              <h2 className="mt-3 text-xl font-extrabold tracking-tight text-white drop-shadow-sm sm:text-2xl">
                Save on Smart Home &amp; Audio Combos
              </h2>
              <p className="mt-2 max-w-xs text-xs leading-relaxed text-[#E8DFD0]/90 sm:text-sm">
                Hand-picked weekly bundles with instant checkout savings and
                official warranty.
              </p>
            </div>

            <div className="relative z-10 mt-4">
              <Link
                href="/deals"
                className="inline-flex items-center gap-2 rounded-xl border border-emerald-400/40 bg-[#163A2B]/85 px-4 py-2.5 text-xs font-bold text-white shadow-md backdrop-blur-md transition-all hover:border-emerald-300 hover:bg-[#2F855A] sm:text-sm"
              >
                <span>Browse Hot Deals</span>
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>

          {/* Card 2: Direct Merchant Care & Order Tracking */}
          <div className="group relative flex min-h-[220px] flex-1 flex-col justify-between overflow-hidden rounded-2xl border border-[#214D3A]/40 bg-[#071710] p-6 text-[#FAF7F0] shadow-md transition-all hover:border-emerald-500/50 hover:shadow-xl sm:min-h-[250px] lg:min-h-[275px] xl:min-h-[295px]">
            {/* Background Image: Connected Living & Tech */}
            <Image
              src="/banner-two.webp"
              alt="Direct Merchant Care"
              fill
              sizes="(max-width: 1024px) 100vw, 420px"
              className="object-cover object-center transition-transform duration-700 ease-out group-hover:scale-105"
            />
            {/* Contrast Gradient */}
            <div
              aria-hidden="true"
              className="absolute inset-0 bg-gradient-to-r from-[#071710]/95 via-[#0b2419]/85 to-transparent/40"
            />
            <div
              aria-hidden="true"
              className="absolute inset-0 bg-gradient-to-t from-[#071710]/90 via-transparent to-transparent"
            />

            {/* Content */}
            <div className="relative z-10">
              <div className="inline-flex items-center gap-1.5 rounded-full border border-emerald-400/30 bg-[#2F855A]/50 px-3 py-1 text-[11px] font-bold tracking-wider text-emerald-200 uppercase backdrop-blur-md">
                <RefreshCw className="h-3 w-3 text-emerald-300" />
                <span>Direct Merchant Care</span>
              </div>
              <h2 className="mt-3 text-xl font-extrabold tracking-tight text-white drop-shadow-sm sm:text-2xl">
                Verified Stock &amp; Fast Order Tracking
              </h2>
              <p className="mt-2 max-w-xs text-xs leading-relaxed text-[#E8DFD0]/90 sm:text-sm">
                Every order ships straight from OpenMart with live fulfillment
                updates.
              </p>
            </div>

            <div className="relative z-10 mt-4 flex flex-wrap items-center gap-2.5">
              <Link
                href="/orders"
                className="inline-flex items-center justify-center rounded-xl bg-white px-4 py-2.5 text-xs font-bold text-[#163A2B] shadow-md transition-all hover:bg-[#FAF7F0] hover:shadow-lg sm:text-sm"
              >
                <span>Track Orders</span>
              </Link>
              <Link
                href="/best-sellers"
                className="inline-flex items-center justify-center rounded-xl border border-white/30 bg-black/30 px-3.5 py-2.5 text-xs font-semibold text-[#FAF7F0] backdrop-blur-md transition-all hover:bg-white/20 sm:text-sm"
              >
                Top Picks
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Service Highlights Strip (High-Trust Bar) */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4 lg:gap-4">
        {SERVICE_HIGHLIGHTS.map((item) => {
          const ItemIcon = item.icon;
          return (
            <div
              key={item.title}
              className="flex items-center gap-4 rounded-2xl border border-[#E5E0D5] bg-white p-4 shadow-xs transition-all hover:border-[#163A2B]/30 hover:shadow-sm"
            >
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[#163A2B]/10 text-[#163A2B]">
                <ItemIcon className="h-6 w-6" />
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

      {/* Featured Departments Grid (Live from Categories API) */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold tracking-tight text-[#163A2B] sm:text-2xl">
              Featured Departments
            </h2>
            <p className="text-xs text-[#6B756D] sm:text-sm">
              Jump directly into our core product categories
            </p>
          </div>
          <Link
            href="/deals"
            className="inline-flex items-center gap-1.5 text-xs font-bold text-[#163A2B] hover:text-[#2F855A] sm:text-sm"
          >
            <span>View All Offers</span>
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5 lg:gap-4">
          {departments.map((dept) => {
            const DeptIcon = getDepartmentIcon(dept.slug);
            return (
              <Link
                key={dept.id}
                href={dept.href}
                className="group flex flex-col justify-between rounded-2xl border border-[#E5E0D5] bg-white p-5 shadow-xs transition-all hover:-translate-y-0.5 hover:border-[#163A2B]/40 hover:shadow-md"
              >
                <div className="flex items-center justify-between">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#F4F2EE] text-[#163A2B] transition-colors group-hover:bg-[#163A2B] group-hover:text-white">
                    <DeptIcon className="h-6 w-6" />
                  </div>
                  <ArrowRight className="h-4 w-4 text-[#6B756D] transition-transform group-hover:translate-x-1 group-hover:text-[#163A2B]" />
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
