'use client';

import * as React from 'react';
import Link from 'next/link';
import {
  ShoppingBag,
  Search,
  ShieldCheck,
  Truck,
  RotateCcw,
  Sparkles,
  Image as ImageIcon,
} from 'lucide-react';
import { toast } from 'sonner';

import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useProducts, type AdminProduct } from '@/hooks/admin/use-products';
import { useCategories } from '@/hooks/admin/use-categories';
import { formatBDT } from '@/lib/utils';

export default function StorefrontHomePage() {
  const [selectedCategory, setSelectedCategory] = React.useState<string>('all');
  const [searchQuery, setSearchQuery] = React.useState<string>('');
  const [cartCount, setCartCount] = React.useState<number>(0);

  const { products, isLoading, total } = useProducts({
    page: 1,
    limit: 50,
    search: searchQuery,
    status: 'active', // Only active products on storefront
  });

  const { categories } = useCategories();

  const filteredProducts = React.useMemo(() => {
    if (selectedCategory === 'all') return products;
    return products.filter((p) => p.categoryId === selectedCategory);
  }, [products, selectedCategory]);

  const handleAddToCart = (product: AdminProduct) => {
    setCartCount((c) => c + 1);
    toast.success(`Added "${product.title}" to your cart!`, {
      description: `${formatBDT(product.priceCents)} • Ready for checkout`,
    });
  };

  return (
    <div className="min-h-screen flex flex-col bg-white text-[#252A25]">
      {/* Top Notification Bar */}
      <div className="bg-[#163A2B] px-4 py-2 text-center text-xs font-medium text-[#FAF7F0]">
        ✨ Free delivery across Bangladesh on orders over ৳ 2,000 |
        Direct-to-Consumer Quality
      </div>

      {/* Main Storefront Navigation */}
      <header className="sticky top-0 z-40 border-b border-[#E5E0D5] bg-[#FAF7F0]/95 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
          {/* Brand Logo */}
          <Link href="/" className="flex items-center gap-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#163A2B] text-white font-bold text-lg shadow-sm">
              OM
            </div>
            <div>
              <span className="text-xl font-bold tracking-tight text-[#163A2B]">
                OPEN-MART
              </span>
              <span className="block text-[10px] font-semibold uppercase tracking-wider text-[#6B756D]">
                Single-Vendor Store
              </span>
            </div>
          </Link>

          {/* Search bar (desktop) */}
          <div className="hidden md:block w-96">
            <Input
              placeholder="Search handcrafted products..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              leftIcon={<Search className="h-4 w-4" />}
              className="bg-white"
            />
          </div>

          {/* Navigation Actions */}
          <div className="flex items-center gap-3">
            <Link
              href="/admin"
              className="hidden sm:inline-flex items-center rounded-lg border border-[#E5E0D5] bg-white px-3 py-1.5 text-xs font-semibold text-[#163A2B] hover:bg-[#FAF7F0] transition-colors"
            >
              Admin Dashboard
            </Link>

            <button
              type="button"
              onClick={() => toast.info('Cart drawer will open here')}
              className="relative flex h-10 w-10 items-center justify-center rounded-xl border border-[#E5E0D5] bg-white text-[#163A2B] hover:bg-[#FAF7F0] transition-colors"
              aria-label="View shopping bag"
            >
              <ShoppingBag className="h-5 w-5" />
              {cartCount > 0 && (
                <span className="absolute -top-1.5 -right-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-[#163A2B] text-[10px] font-bold text-white shadow-xs">
                  {cartCount}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Mobile Search Input */}
        <div className="px-4 pb-3 md:hidden">
          <Input
            placeholder="Search products..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            leftIcon={<Search className="h-4 w-4" />}
            className="bg-white"
          />
        </div>
      </header>

      {/* Hero Banner */}
      <section className="relative overflow-hidden border-b border-[#E5E0D5] bg-gradient-to-b from-[#163A2B]/5 to-transparent py-12 sm:py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 text-center">
          <div className="inline-flex items-center gap-1.5 rounded-full border border-[#163A2B]/20 bg-[#163A2B]/5 px-3 py-1 text-xs font-semibold text-[#163A2B] mb-4">
            <Sparkles className="h-3.5 w-3.5" />
            Direct from Single Merchant
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight text-[#163A2B] sm:text-5xl">
            Pure Quality, Handcrafted Care
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-base text-[#6B756D] sm:text-lg">
            Discover thoughtfully sourced, authentic products crafted with
            uncompromising attention to detail and sustainable stewardship.
          </p>
        </div>
      </section>

      {/* Main Content Area */}
      <main className="mx-auto max-w-7xl flex-1 px-4 py-8 sm:px-6 lg:px-8 w-full">
        {/* Category Filters */}
        <div className="flex items-center gap-2 overflow-x-auto pb-4 no-scrollbar">
          <button
            type="button"
            onClick={() => setSelectedCategory('all')}
            className={`shrink-0 rounded-full px-4 py-2 text-xs font-semibold transition-all ${
              selectedCategory === 'all'
                ? 'bg-[#163A2B] text-white shadow-xs'
                : 'border border-[#E5E0D5] bg-white text-[#252A25] hover:border-[#163A2B]'
            }`}
          >
            All Products ({total})
          </button>

          {categories.map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => setSelectedCategory(cat.id)}
              className={`shrink-0 rounded-full px-4 py-2 text-xs font-semibold transition-all ${
                selectedCategory === cat.id
                  ? 'bg-[#163A2B] text-white shadow-xs'
                  : 'border border-[#E5E0D5] bg-white text-[#252A25] hover:border-[#163A2B]'
              }`}
            >
              {cat.name}
            </button>
          ))}
        </div>

        {/* Products Grid */}
        <div className="mt-6">
          {isLoading ? (
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {Array.from({ length: 8 }).map((_, i) => (
                <div
                  key={i}
                  className="rounded-2xl border border-[#E5E0D5] bg-white p-4 space-y-3"
                >
                  <Skeleton className="aspect-square w-full rounded-xl" />
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-4 w-1/2" />
                  <Skeleton className="h-10 w-full rounded-lg" />
                </div>
              ))}
            </div>
          ) : filteredProducts.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-[#E5E0D5] bg-white p-12 text-center my-8">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[#FAF7F0] text-[#6B756D] mb-4">
                <Package className="h-7 w-7 text-[#163A2B]" />
              </div>
              <h3 className="text-lg font-bold text-[#252A25]">
                No products found in this collection
              </h3>
              <p className="mt-1 text-sm text-[#6B756D]">
                {searchQuery
                  ? `No matches found for "${searchQuery}". Try different keywords.`
                  : 'No active products are available yet. Visit the admin portal to add products.'}
              </p>
              <div className="mt-6 flex justify-center gap-3">
                <Button
                  variant="primary"
                  fullWidth={false}
                  onClick={() => {
                    setSelectedCategory('all');
                    setSearchQuery('');
                  }}
                >
                  Reset Filters
                </Button>
                <Link href="/admin/products/new">
                  <Button variant="outline" fullWidth={false}>
                    Create Product in Admin
                  </Button>
                </Link>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {filteredProducts.map((product) => {
                const primaryImage =
                  product.media?.find((m) => m.isPrimary)?.url ||
                  product.media?.[0]?.url;
                const isOutOfStock = (product.availableStock ?? 0) <= 0;

                return (
                  <div
                    key={product.id}
                    className="group flex flex-col justify-between overflow-hidden rounded-2xl border border-[#E5E0D5] bg-white p-4 shadow-xs transition-all duration-200 hover:border-[#163A2B]/40 hover:shadow-md"
                  >
                    <div>
                      {/* Product Thumbnail Image */}
                      <div className="relative aspect-square w-full overflow-hidden rounded-xl bg-[#FAF7F0]">
                        {primaryImage ? (
                          /* eslint-disable-next-line @next/next/no-img-element */
                          <img
                            src={primaryImage}
                            alt={product.title}
                            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center text-[#6B756D]/60">
                            <ImageIcon className="h-10 w-10" />
                          </div>
                        )}

                        {/* Category Tag Badge */}
                        {product.categoryName && (
                          <span className="absolute top-2.5 left-2.5 rounded-md bg-white/90 backdrop-blur-xs px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-[#163A2B] shadow-xs">
                            {product.categoryName}
                          </span>
                        )}

                        {/* Out of Stock Ribbon */}
                        {isOutOfStock && (
                          <span className="absolute top-2.5 right-2.5 rounded-md bg-[#C53030] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white shadow-xs">
                            Out of Stock
                          </span>
                        )}
                      </div>

                      {/* Title & SKU */}
                      <div className="mt-4">
                        <span className="text-[10px] font-mono font-semibold uppercase text-[#6B756D]">
                          SKU: {product.sku}
                        </span>
                        <h3 className="mt-1 line-clamp-2 text-sm font-bold text-[#252A25] group-hover:text-[#163A2B] transition-colors">
                          {product.title}
                        </h3>
                        {product.description && (
                          <p className="mt-1 line-clamp-2 text-xs text-[#6B756D]">
                            {product.description}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Price and Cart Button */}
                    <div className="mt-4 pt-3 border-t border-[#E5E0D5]">
                      <div className="flex items-baseline justify-between mb-3">
                        <span className="text-lg font-extrabold text-[#163A2B]">
                          {formatBDT(product.priceCents)}
                        </span>
                        <span className="text-[11px] font-medium text-[#267A46]">
                          {!isOutOfStock
                            ? `${product.availableStock} in stock`
                            : 'Backorder soon'}
                        </span>
                      </div>

                      <Button
                        variant={isOutOfStock ? 'outline' : 'primary'}
                        fullWidth
                        size="sm"
                        disabled={isOutOfStock}
                        onClick={() => handleAddToCart(product)}
                        leftIcon={<ShoppingBag className="h-4 w-4" />}
                      >
                        {isOutOfStock ? 'Sold Out' : 'Add to Bag'}
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>

      {/* Value Proposition Highlights */}
      <section className="border-t border-[#E5E0D5] bg-white py-12">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 gap-8 sm:grid-cols-3">
            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[#163A2B]/10 text-[#163A2B]">
                <ShieldCheck className="h-6 w-6" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-[#252A25]">
                  Single-Vendor Authenticity
                </h4>
                <p className="mt-1 text-xs text-[#6B756D]">
                  Every single item is directly curated and verified by our
                  dedicated team with 100% quality assurance.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[#163A2B]/10 text-[#163A2B]">
                <Truck className="h-6 w-6" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-[#252A25]">
                  Express Nationwide Dispatch
                </h4>
                <p className="mt-1 text-xs text-[#6B756D]">
                  Secure packaging and fast delivery to all 64 districts in
                  Bangladesh.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[#163A2B]/10 text-[#163A2B]">
                <RotateCcw className="h-6 w-6" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-[#252A25]">
                  7-Day Hassle-Free Returns
                </h4>
                <p className="mt-1 text-xs text-[#6B756D]">
                  Not completely satisfied? Contact our direct customer support
                  team for an effortless exchange.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Store Footer */}
      <footer className="border-t border-[#E5E0D5] bg-[#FAF7F0] py-8 text-center text-xs text-[#6B756D]">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p>
            © 2026 OPEN-MART. All rights reserved. Single-Vendor E-Commerce
            Platform.
          </p>
          <div className="flex items-center gap-4">
            <Link
              href="/admin"
              className="font-semibold text-[#163A2B] hover:underline"
            >
              Merchant Admin Portal
            </Link>
            <span>•</span>
            <Link href="/admin/login" className="hover:underline">
              Staff Login
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

function Package(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d="M11 21.73a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73z" />
      <path d="M12 22V12" />
      <path d="m3.3 7 7.703 4.734a2 2 0 0 0 1.994 0L20.7 7" />
      <path d="m7.5 4.27 9 5.15" />
    </svg>
  );
}
