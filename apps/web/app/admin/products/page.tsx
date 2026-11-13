'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import {
  Plus,
  Search,
  Edit3,
  Trash2,
  Archive,
  RotateCcw,
  Package,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Image as ImageIcon,
  Layers,
  ChevronLeft,
  ChevronRight,
  X,
} from 'lucide-react';

import { AdminPageHeader } from '@/components/admin/layout/admin-page-header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Tabs } from '@/components/ui/tabs';
import { StatusBadge } from '@/components/ui/badge';
import { DataTable, type Column } from '@/components/ui/data-table';
import { DropdownMenu } from '@/components/ui/dropdown-menu';
import { KpiCard } from '@/components/ui/kpi-card';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { useProducts, type AdminProduct } from '@/hooks/admin/use-products';
import { useCategories } from '@/hooks/admin/use-categories';
import { formatBDT } from '@/lib/utils';

const PRODUCT_STATUS_TABS = [
  { id: 'all', label: 'All Products' },
  { id: 'active', label: 'Published' },
  { id: 'draft', label: 'Drafts' },
  { id: 'archived', label: 'Archived' },
];

export default function AdminProductsPage() {
  const router = useRouter();

  // Filter & Pagination State
  const [activeTab, setActiveTab] = React.useState<string>('all');
  const [selectedCategory, setSelectedCategory] = React.useState<string>('');
  const [stockFilter, setStockFilter] = React.useState<string>('all');
  const [page, setPage] = React.useState<number>(1);
  const [limit, setLimit] = React.useState<number>(10);
  const [searchInput, setSearchInput] = React.useState<string>('');
  const [debouncedSearch, setDebouncedSearch] = React.useState<string>('');

  // Modals state
  const [productToDelete, setProductToDelete] =
    React.useState<AdminProduct | null>(null);

  // Debounce search
  React.useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchInput.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  // Data fetching
  const { categories, isLoading: isLoadingCategories } = useCategories();
  const {
    products,
    total,
    totalPages,
    isLoading,
    deleteProduct,
    isDeleting,
    archiveProduct,
    restoreProduct,
  } = useProducts({
    page,
    limit,
    search: debouncedSearch || undefined,
    status: activeTab,
    category: selectedCategory || undefined,
  });

  // Derive safe page within bounds
  const currentPage = totalPages > 0 ? Math.min(page, totalPages) : page;

  // Client-side stock status filter if applied
  const displayedProducts = React.useMemo(() => {
    if (stockFilter === 'in_stock') {
      return products.filter((p) => (p.availableStock ?? 0) > 0);
    }
    if (stockFilter === 'out_of_stock') {
      return products.filter((p) => (p.availableStock ?? 0) <= 0);
    }
    return products;
  }, [products, stockFilter]);

  // Summary Metrics for KPI cards
  const summaryMetrics = React.useMemo(() => {
    const inStockCount = products.filter(
      (p) => (p.availableStock ?? 0) > 0,
    ).length;
    const outOfStockCount = products.filter(
      (p) => (p.availableStock ?? 0) <= 0,
    ).length;
    const publishedCount = products.filter((p) => p.isPublished).length;
    const totalInventoryUnits = products.reduce(
      (sum, p) => sum + (p.availableStock ?? 0),
      0,
    );

    return {
      inStockCount,
      outOfStockCount,
      publishedCount,
      totalInventoryUnits,
    };
  }, [products]);

  const handleDeleteConfirm = async () => {
    if (!productToDelete) return;
    try {
      await deleteProduct(productToDelete.id);
      setProductToDelete(null);
    } catch {
      // Toast error handled in mutation
    }
  };

  const handleArchive = async (product: AdminProduct) => {
    try {
      await archiveProduct(product.id);
    } catch {
      // Toast handled
    }
  };

  const handleRestore = async (product: AdminProduct) => {
    try {
      await restoreProduct(product.id);
    } catch {
      // Toast handled
    }
  };

  const columns: Column<AdminProduct>[] = [
    {
      header: 'Product',
      accessorKey: 'title',
      cell: (product) => (
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg border border-[#E5E0D5] bg-[#FAF7F0] overflow-hidden text-[#6B756D]">
            {product.media &&
            product.media.length > 0 &&
            product.media[0]?.url ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={product.media[0].thumbnailUrl || product.media[0].url}
                alt={product.title}
                className="h-full w-full object-cover"
              />
            ) : (
              <ImageIcon className="h-5 w-5 text-[#6B756D]/60" />
            )}
          </div>
          <div className="min-w-0">
            <p className="font-semibold text-[#252A25] max-w-xs truncate">
              {product.title}
            </p>
            <div className="flex flex-wrap items-center gap-2 mt-0.5">
              <span className="text-[11px] font-mono uppercase tracking-wider text-[#6B756D]">
                SKU: {product.sku}
              </span>
              {product.variants && product.variants.length > 0 && (
                <span className="inline-flex items-center rounded-full bg-[#163A2B]/10 px-2 py-0.5 text-[10px] font-semibold text-[#163A2B]">
                  {product.variants.length}{' '}
                  {product.variants.length === 1 ? 'variant' : 'variants'}
                </span>
              )}
            </div>
          </div>
        </div>
      ),
    },
    {
      header: 'Category',
      accessorKey: 'categoryName',
      cell: (product) => (
        <span className="inline-flex items-center rounded-md bg-[#FAF7F0] px-2.5 py-1 text-xs font-medium text-[#252A25] border border-[#E5E0D5]">
          {product.categoryName || 'Uncategorized'}
        </span>
      ),
    },
    {
      header: 'Price (BDT)',
      accessorKey: 'priceCents',
      cell: (product) => (
        <span className="font-bold text-[#163A2B]">
          {formatBDT(product.priceCents)}
        </span>
      ),
    },
    {
      header: 'Stock',
      accessorKey: 'availableStock',
      align: 'center',
      cell: (product) => (
        <span
          className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
            (product.availableStock ?? 0) > 0
              ? 'bg-[#267A46]/10 text-[#267A46]'
              : 'bg-[#C53030]/10 text-[#C53030]'
          }`}
        >
          {product.availableStock ?? 0} in stock
        </span>
      ),
    },
    {
      header: 'OCC Version',
      accessorKey: 'version',
      align: 'center',
      cell: (product) => (
        <span className="rounded-full border border-[#E5E0D5] bg-[#FAF7F0] px-2.5 py-0.5 text-[11px] font-mono text-[#6B756D]">
          v{product.version}
        </span>
      ),
    },
    {
      header: 'Status',
      accessorKey: 'isPublished',
      cell: (product) => (
        <StatusBadge
          status={
            product.status === 'archived'
              ? 'Archived'
              : product.isPublished
                ? 'Published'
                : 'Draft'
          }
        />
      ),
    },
    {
      header: 'Actions',
      align: 'right',
      cell: (product) => (
        <div
          className="flex items-center justify-end"
          onClick={(e) => e.stopPropagation()}
        >
          <DropdownMenu
            actions={[
              {
                label: 'Edit Details',
                icon: <Edit3 className="h-4 w-4" />,
                onClick: () =>
                  router.push(`/admin/products/${product.id}/edit`),
              },
              product.status === 'archived'
                ? {
                    label: 'Restore to Draft',
                    icon: <RotateCcw className="h-4 w-4" />,
                    onClick: () => handleRestore(product),
                  }
                : {
                    label: 'Archive Product',
                    icon: <Archive className="h-4 w-4" />,
                    onClick: () => handleArchive(product),
                  },
              {
                label: 'Delete Permanently',
                icon: <Trash2 className="h-4 w-4" />,
                variant: 'destructive',
                onClick: () => setProductToDelete(product),
              },
            ]}
          />
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Product Catalog & Variants"
        subtitle="Manage inventory items, pricing, multi-image media, variants matrix, and catalog visibility."
        breadcrumbs={[{ label: 'Catalog' }, { label: 'Products' }]}
        actions={
          <Button
            variant="primary"
            size="sm"
            fullWidth={false}
            onClick={() => router.push('/admin/products/new')}
            leftIcon={<Plus className="h-4 w-4" />}
          >
            Create Product
          </Button>
        }
      />

      {/* KPI Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          title="Total Products"
          value={total}
          icon={Package}
          subtitle={`${summaryMetrics.totalInventoryUnits} total units in stock`}
        />
        <KpiCard
          title="Published Catalog"
          value={summaryMetrics.publishedCount}
          icon={CheckCircle2}
          subtitle="Active and visible to buyers"
        />
        <KpiCard
          title="Categories Available"
          value={categories.length}
          icon={Layers}
          subtitle="Taxonomies & groupings"
        />
        <KpiCard
          title="Out of Stock Warnings"
          value={summaryMetrics.outOfStockCount}
          icon={summaryMetrics.outOfStockCount > 0 ? AlertTriangle : XCircle}
          subtitle={
            summaryMetrics.outOfStockCount > 0
              ? 'Items needing replenishment'
              : 'All items in stock'
          }
        />
      </div>

      {/* Tabs & Filters Bar */}
      <div className="space-y-3">
        {/* Top row: Status Tabs */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <Tabs
              tabs={PRODUCT_STATUS_TABS}
              activeTab={activeTab}
              onChange={(tabId) => {
                setActiveTab(tabId);
                setPage(1);
              }}
            />
          </div>

          <span className="text-xs text-[#6B756D] font-medium">
            Showing {displayedProducts.length} of {total} products
          </span>
        </div>

        {/* Bottom row: Search + Category Filter + Stock Filter + Reset */}
        <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-center">
          {/* Search */}
          <div className="sm:col-span-5 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#6B756D]" />
            <Input
              type="text"
              placeholder="Search products by title, SKU, or description..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="pl-9 pr-8 h-9 text-xs"
            />
            {searchInput && (
              <button
                type="button"
                onClick={() => setSearchInput('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#6B756D] hover:text-[#252A25]"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {/* Category Filter */}
          <div className="sm:col-span-3">
            <Select
              value={selectedCategory}
              onChange={(e) => {
                setSelectedCategory(e.target.value);
                setPage(1);
              }}
              disabled={isLoadingCategories}
              className="h-9 text-xs"
            >
              <option value="">All Categories</option>
              {categories.map((cat) => (
                <option key={cat.id} value={cat.slug || cat.id}>
                  {cat.name}
                </option>
              ))}
            </Select>
          </div>

          {/* Stock Level Filter */}
          <div className="sm:col-span-2">
            <Select
              value={stockFilter}
              onChange={(e) => {
                setStockFilter(e.target.value);
                setPage(1);
              }}
              className="h-9 text-xs"
            >
              <option value="all">All Stock</option>
              <option value="in_stock">In Stock</option>
              <option value="out_of_stock">Out of Stock</option>
            </Select>
          </div>

          {/* Per-Page Limit Selector */}
          <div className="sm:col-span-2">
            <Select
              value={String(limit)}
              onChange={(e) => {
                setLimit(Number(e.target.value));
                setPage(1);
              }}
              className="h-9 text-xs"
            >
              <option value="10">10 per page</option>
              <option value="25">25 per page</option>
              <option value="50">50 per page</option>
            </Select>
          </div>
        </div>
      </div>

      {/* Products Data Table */}
      <div className="space-y-4">
        <DataTable
          columns={columns}
          data={displayedProducts}
          isLoading={isLoading}
          emptyMessage={
            debouncedSearch || selectedCategory || stockFilter !== 'all'
              ? 'No products matched your search or active filters.'
              : 'No products in catalog yet. Click "Create Product" to add your first item.'
          }
          onRowClick={(product) =>
            router.push(`/admin/products/${product.id}/edit`)
          }
        />

        {/* Enhanced Pagination Bar */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-1 text-xs text-[#6B756D]">
          <div>
            Showing{' '}
            <span className="font-semibold text-[#252A25]">
              {total === 0 ? 0 : (currentPage - 1) * limit + 1}
            </span>{' '}
            to{' '}
            <span className="font-semibold text-[#252A25]">
              {Math.min(currentPage * limit, total)}
            </span>{' '}
            of <span className="font-semibold text-[#252A25]">{total}</span>{' '}
            products
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              fullWidth={false}
              disabled={currentPage <= 1 || isLoading}
              onClick={() => setPage((prev) => Math.max(1, prev - 1))}
              className="h-8 px-3 text-xs border-[#E5E0D5]"
            >
              <ChevronLeft className="h-3.5 w-3.5 mr-1" />
              Previous
            </Button>

            <span className="inline-flex items-center rounded-md border border-[#E5E0D5] bg-[#FAF7F0] px-2.5 py-1 font-medium text-[#252A25]">
              Page {currentPage} of {Math.max(1, totalPages)}
            </span>

            <Button
              variant="outline"
              size="sm"
              fullWidth={false}
              disabled={currentPage >= totalPages || isLoading}
              onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
              className="h-8 px-3 text-xs border-[#E5E0D5]"
            >
              Next
              <ChevronRight className="h-3.5 w-3.5 ml-1" />
            </Button>
          </div>
        </div>
      </div>

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        isOpen={Boolean(productToDelete)}
        onClose={() => setProductToDelete(null)}
        onConfirm={handleDeleteConfirm}
        title="Delete Product"
        description={`Are you sure you want to permanently delete "${productToDelete?.title}" (SKU: ${productToDelete?.sku})? Product images will remain preserved in your Media Library for reuse or separate deletion.`}
        confirmLabel="Delete Permanently"
        variant="destructive"
        loading={isDeleting}
      />
    </div>
  );
}
