'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  ArrowRight,
  Package,
  Search,
  SlidersHorizontal,
  Sparkles,
  Tag,
  X,
} from 'lucide-react';
import { useStorefrontProducts } from '@/hooks/storefront/use-storefront-products';
import { useStorefrontCategories } from '@/hooks/storefront/use-storefront-categories';
import { formatBDT } from '@/lib/utils';

const QUICK_SEARCH_EXAMPLES = [
  'panjabi',
  'laptop',
  'headphone',
  'smart lock',
  'dashcam',
];

interface SearchResultsContentProps {
  initialQuery: string;
  initialCategory: string;
  initialPage: number;
}

function SearchResultsContent({
  initialQuery,
  initialCategory,
  initialPage,
}: SearchResultsContentProps) {
  const router = useRouter();

  const [queryInput, setQueryInput] = React.useState(initialQuery);
  const [minPriceBDT, setMinPriceBDT] = React.useState('');
  const [maxPriceBDT, setMaxPriceBDT] = React.useState('');

  const { departments } = useStorefrontCategories();

  const minPriceCents =
    minPriceBDT.trim() && !Number.isNaN(Number(minPriceBDT))
      ? Math.max(0, Math.round(Number(minPriceBDT) * 100))
      : undefined;
  const maxPriceCents =
    maxPriceBDT.trim() && !Number.isNaN(Number(maxPriceBDT))
      ? Math.max(0, Math.round(Number(maxPriceBDT) * 100))
      : undefined;

  const { data, isLoading, isFetching } = useStorefrontProducts({
    search: initialQuery,
    category: initialCategory,
    minPrice: minPriceCents,
    maxPrice: maxPriceCents,
    page: initialPage,
    limit: 20,
  });

  const products = data?.data ?? [];
  const meta = data?.meta ?? {
    total: 0,
    page: initialPage,
    limit: 20,
    totalPages: 1,
  };

  const navigateWithParams = (next: {
    q?: string;
    category?: string;
    page?: number;
  }) => {
    const params = new URLSearchParams();
    const q = (next.q ?? queryInput).trim();
    const category = next.category ?? initialCategory;
    const page = next.page ?? 1;

    if (q) params.set('q', q);
    if (category && category !== 'all') params.set('category', category);
    if (page > 1) params.set('page', String(page));

    const qs = params.toString();
    router.push(qs ? `/search?${qs}` : '/search');
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    navigateWithParams({ q: queryInput, category: initialCategory, page: 1 });
  };

  return (
    <div className="space-y-6">
      {/* Search Bar & Metadata Header */}
      <section className="rounded-xl border border-[#E5E0D5] bg-white p-5 shadow-xs">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="inline-flex items-center gap-1.5 rounded-full bg-[#2F855A]/10 px-3 py-1 text-xs font-bold text-[#163A2B]">
              <Sparkles className="h-3.5 w-3.5 text-[#2F855A]" />
              <span>Smart Trigram &amp; Banglish Search</span>
            </div>
            <h1 className="mt-2 text-2xl font-bold tracking-tight text-[#163A2B]">
              {initialQuery
                ? `Search results for "${initialQuery}"`
                : 'Explore Storefront Catalog'}
            </h1>
            <p className="mt-0.5 text-sm text-[#6B756D]">
              {isLoading
                ? 'Searching catalog...'
                : `${meta.total} matching ${meta.total === 1 ? 'product' : 'products'} found`}
              {isFetching && !isLoading ? ' • Updating...' : ''}
            </p>
          </div>

          <form
            onSubmit={handleSubmit}
            className="flex w-full flex-col gap-2.5 sm:flex-row lg:max-w-xl"
          >
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-[#6B756D]" />
              <input
                type="search"
                value={queryInput}
                onChange={(e) => setQueryInput(e.target.value)}
                placeholder="Search in English, Banglish (panjabi, leptop) or বাংলা..."
                className="h-11 w-full rounded-lg border border-[#E5E0D5] bg-[#FAF7F0]/50 pr-9 pl-10 text-sm text-[#252A25] placeholder:text-[#6B756D] focus:border-[#163A2B] focus:bg-white focus:outline-none"
              />
              {queryInput && (
                <button
                  type="button"
                  onClick={() => {
                    setQueryInput('');
                    navigateWithParams({ q: '', page: 1 });
                  }}
                  aria-label="Clear search"
                  className="absolute top-1/2 right-2.5 -translate-y-1/2 cursor-pointer text-[#6B756D] hover:text-[#252A25]"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>

            <button
              type="submit"
              className="inline-flex h-11 shrink-0 cursor-pointer items-center justify-center gap-2 rounded-lg bg-[#163A2B] px-5 text-sm font-bold text-white transition-colors hover:bg-[#214D3A]"
            >
              <span>Search</span>
              <ArrowRight className="h-4 w-4" />
            </button>
          </form>
        </div>

        {/* Filters Strip: Department + BDT Price Range */}
        <div className="mt-4 flex flex-col gap-3 border-t border-[#E5E0D5]/70 pt-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex max-w-full flex-nowrap items-center gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <span className="inline-flex shrink-0 items-center gap-1 text-xs font-semibold text-[#6B756D]">
              <SlidersHorizontal className="h-3.5 w-3.5" />
              Department:
            </span>
            <button
              type="button"
              onClick={() => navigateWithParams({ category: 'all', page: 1 })}
              className={`shrink-0 cursor-pointer rounded-full px-3 py-1 text-xs font-semibold transition-colors ${
                initialCategory === 'all'
                  ? 'bg-[#163A2B] text-white'
                  : 'bg-[#F4F2EE] text-[#252A25] hover:bg-[#E8DFD0]'
              }`}
            >
              All Departments
            </button>
            {departments.map((dept) => (
              <button
                key={dept.id}
                type="button"
                onClick={() =>
                  navigateWithParams({ category: dept.slug, page: 1 })
                }
                className={`shrink-0 cursor-pointer rounded-full px-3 py-1 text-xs font-semibold whitespace-nowrap transition-colors ${
                  initialCategory === dept.slug
                    ? 'bg-[#163A2B] text-white'
                    : 'bg-[#F4F2EE] text-[#252A25] hover:bg-[#E8DFD0]'
                }`}
              >
                {dept.name}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <input
              type="number"
              min={0}
              value={minPriceBDT}
              onChange={(e) => setMinPriceBDT(e.target.value)}
              placeholder="Min ৳"
              aria-label="Minimum price in BDT"
              className="h-9 w-24 rounded-lg border border-[#E5E0D5] bg-white px-3 text-xs text-[#252A25] focus:border-[#163A2B] focus:outline-none"
            />
            <span className="text-xs text-[#6B756D]">to</span>
            <input
              type="number"
              min={0}
              value={maxPriceBDT}
              onChange={(e) => setMaxPriceBDT(e.target.value)}
              placeholder="Max ৳"
              aria-label="Maximum price in BDT"
              className="h-9 w-24 rounded-lg border border-[#E5E0D5] bg-white px-3 text-xs text-[#252A25] focus:border-[#163A2B] focus:outline-none"
            />
            {(minPriceBDT ||
              maxPriceBDT ||
              initialCategory !== 'all' ||
              initialQuery) && (
              <button
                type="button"
                onClick={() => {
                  setMinPriceBDT('');
                  setMaxPriceBDT('');
                  setQueryInput('');
                  router.push('/search');
                }}
                className="cursor-pointer rounded-lg border border-[#E5E0D5] px-3 py-1.5 text-xs font-semibold text-[#163A2B] hover:bg-[#FAF7F0]"
              >
                Reset
              </button>
            )}
          </div>
        </div>
      </section>

      {/* Results Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5">
          {Array.from({ length: 10 }).map((_, idx) => (
            <div
              key={idx}
              className="h-80 animate-pulse rounded-xl border border-[#E5E0D5] bg-white p-4"
            >
              <div className="h-44 rounded-lg bg-[#F4F2EE]" />
              <div className="mt-4 h-4 w-3/4 rounded bg-[#F4F2EE]" />
              <div className="mt-2 h-3 w-1/2 rounded bg-[#F4F2EE]" />
            </div>
          ))}
        </div>
      ) : products.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-[#E5E0D5] bg-white px-6 py-16 text-center shadow-xs">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#F4F2EE] text-[#163A2B]">
            <Package className="h-7 w-7" />
          </div>
          <h2 className="mt-4 text-lg font-bold text-[#163A2B]">
            No matching products found
          </h2>
          <p className="mt-1 max-w-md text-sm text-[#6B756D]">
            Try searching with fewer keywords, Banglish phonetics, or pick a
            popular term below.
          </p>
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            {QUICK_SEARCH_EXAMPLES.map((term) => (
              <button
                key={term}
                type="button"
                onClick={() => {
                  setQueryInput(term);
                  navigateWithParams({ q: term, category: 'all', page: 1 });
                }}
                className="cursor-pointer rounded-full border border-[#E5E0D5] bg-[#FAF7F0] px-3.5 py-1.5 text-xs font-semibold text-[#163A2B] hover:bg-[#E8DFD0]"
              >
                Try &ldquo;{term}&rdquo;
              </button>
            ))}
          </div>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5">
            {products.map((product) => {
              const thumbnail =
                product.media.find((m) => m.isThumbnail)?.url ??
                product.media[0]?.url;
              const inStock =
                !product.trackQuantity || product.inventoryQuantity > 0;

              return (
                <Link
                  key={product.id}
                  href={`/products/${product.id}`}
                  className="group flex flex-col justify-between overflow-hidden rounded-xl border border-[#E5E0D5] bg-white shadow-xs transition-all hover:border-[#163A2B]/40 hover:shadow-md"
                >
                  <div>
                    <div className="relative aspect-[4/3] w-full overflow-hidden bg-[#F4F2EE]">
                      {thumbnail ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={thumbnail}
                          alt={product.title}
                          className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-[#6B756D]">
                          <Package className="h-10 w-10" />
                        </div>
                      )}

                      {product.category?.name && (
                        <span className="absolute top-2.5 left-2.5 inline-flex items-center gap-1 rounded-full bg-[#163A2B]/90 px-2.5 py-0.5 text-[11px] font-semibold text-white">
                          <Tag className="h-3 w-3" />
                          {product.category.name}
                        </span>
                      )}
                    </div>

                    <div className="space-y-1.5 p-4">
                      <h2 className="line-clamp-2 text-[15px] leading-snug font-bold text-[#252A25] group-hover:text-[#163A2B]">
                        {product.title}
                      </h2>
                      <p className="line-clamp-2 text-xs text-[#6B756D]">
                        {product.description || `SKU: ${product.sku}`}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between border-t border-[#E5E0D5]/60 px-4 py-3">
                    <div>
                      <p className="text-base font-bold text-[#163A2B]">
                        {formatBDT(product.unitPrice)}
                      </p>
                      {product.compareAtPrice &&
                        product.compareAtPrice > product.unitPrice && (
                          <p className="text-xs text-[#6B756D] line-through">
                            {formatBDT(product.compareAtPrice)}
                          </p>
                        )}
                    </div>
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
                        inStock
                          ? 'bg-[#267A46]/15 text-[#267A46]'
                          : 'bg-[#C53030]/15 text-[#C53030]'
                      }`}
                    >
                      {inStock ? 'In Stock' : 'Out of Stock'}
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>

          {meta.totalPages > 1 && (
            <div className="flex flex-col items-center justify-between gap-3 pt-2 text-xs text-[#6B756D] sm:flex-row">
              <span>
                Page <strong className="text-[#252A25]">{meta.page}</strong> of{' '}
                <strong className="text-[#252A25]">{meta.totalPages}</strong> (
                {meta.total} products)
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={meta.page <= 1}
                  onClick={() => navigateWithParams({ page: meta.page - 1 })}
                  className="cursor-pointer rounded-lg border border-[#E5E0D5] bg-white px-4 py-2 font-semibold text-[#163A2B] hover:bg-[#FAF7F0] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Previous
                </button>
                <button
                  type="button"
                  disabled={meta.page >= meta.totalPages}
                  onClick={() => navigateWithParams({ page: meta.page + 1 })}
                  className="cursor-pointer rounded-lg border border-[#E5E0D5] bg-white px-4 py-2 font-semibold text-[#163A2B] hover:bg-[#FAF7F0] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function SearchResultsBoundary() {
  const searchParams = useSearchParams();
  const initialQuery = searchParams.get('q') ?? '';
  const initialCategory = searchParams.get('category') ?? 'all';
  const initialPage = Math.max(1, Number(searchParams.get('page') ?? '1') || 1);

  return (
    <SearchResultsContent
      key={`${initialQuery}::${initialCategory}`}
      initialQuery={initialQuery}
      initialCategory={initialCategory}
      initialPage={initialPage}
    />
  );
}

export default function StorefrontSearchPage() {
  return (
    <React.Suspense
      fallback={
        <div className="rounded-xl border border-[#E5E0D5] bg-white p-8 text-center text-sm text-[#6B756D]">
          Loading storefront search...
        </div>
      }
    >
      <SearchResultsBoundary />
    </React.Suspense>
  );
}
