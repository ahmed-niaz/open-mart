'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Search, Edit3, Image as ImageIcon } from 'lucide-react';

import { AdminPageHeader } from '@/components/admin/layout/admin-page-header';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { StatusBadge } from '@/components/ui/badge';
import { DataTable, type Column } from '@/components/ui/data-table';
import { useProducts, type AdminProduct } from '@/hooks/admin/use-products';
import { formatBDT } from '@/lib/utils';

export default function AdminProductsPage() {
  const router = useRouter();
  const [page, setPage] = React.useState(1);
  const [search, setSearch] = React.useState('');

  const { products, total, totalPages, isLoading } = useProducts({
    page,
    limit: 10,
    search,
    status: 'all',
  });

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
            <span className="text-[11px] font-mono uppercase tracking-wider text-[#6B756D]">
              SKU: {product.sku}
            </span>
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
          className={`rounded-md px-2 py-0.5 text-xs font-semibold ${
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
        <span className="rounded-md border border-[#E5E0D5] bg-[#FAF7F0] px-2 py-0.5 text-[11px] font-mono text-[#6B756D]">
          v{product.version}
        </span>
      ),
    },
    {
      header: 'Status',
      accessorKey: 'isPublished',
      cell: (product) => (
        <StatusBadge status={product.isPublished ? 'Published' : 'Draft'} />
      ),
    },
    {
      header: 'Actions',
      align: 'right',
      cell: (product) => (
        <div className="flex items-center justify-end gap-2">
          <Button
            variant="outline"
            size="sm"
            fullWidth={false}
            onClick={(e) => {
              e.stopPropagation();
              router.push(`/admin/products/${product.id}/edit`);
            }}
            leftIcon={<Edit3 className="h-3.5 w-3.5" />}
          >
            Edit
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Product Catalog"
        subtitle="Manage inventory items, pricing, multi-image media, and published catalog status."
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

      {/* Search Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
        <div className="w-full sm:w-80">
          <Input
            placeholder="Search products by title or SKU..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            leftIcon={<Search className="h-4 w-4" />}
          />
        </div>
      </div>

      {/* Products Table */}
      <Card className="shadow-xs border-[#E5E0D5]">
        <CardContent className="pt-5">
          <DataTable
            columns={columns}
            data={products}
            isLoading={isLoading}
            emptyMessage="No products found in catalog."
            onRowClick={(product) =>
              router.push(`/admin/products/${product.id}/edit`)
            }
            pagination={{
              page,
              totalPages,
              totalCount: total,
              onPageChange: (newPage) => setPage(newPage),
            }}
          />
        </CardContent>
      </Card>
    </div>
  );
}
