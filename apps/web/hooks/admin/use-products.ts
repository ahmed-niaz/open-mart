'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { apiClient } from '@/lib/api-client';

export interface ProductMedia {
  id: string;
  url: string;
  thumbnailUrl?: string;
  isPrimary: boolean;
}

export interface AdminProduct {
  id: string;
  title: string;
  sku: string;
  description?: string;
  priceCents: number;
  currency: string;
  categoryId?: string;
  categoryName?: string;
  status: string;
  isPublished: boolean;
  version: number;
  media: ProductMedia[];
  availableStock?: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateProductInput {
  title: string;
  sku: string;
  description?: string;
  priceBDT?: number;
  priceCents?: number;
  currency?: string;
  categoryId?: string;
  isPublished?: boolean;
  inventoryQuantity?: number;
}

export interface UpdateProductInput {
  id: string;
  version: number;
  title?: string;
  description?: string;
  priceBDT?: number;
  priceCents?: number;
  categoryId?: string;
  isPublished?: boolean;
  inventoryQuantity?: number;
}

interface RawProductResponse {
  id: string;
  title: string;
  sku: string;
  description?: string;
  unitPrice?: number;
  priceCents?: number;
  currency?: string;
  status?: string;
  categoryId?: string | null;
  category?: { id?: string; name?: string; slug?: string } | null;
  categoryName?: string;
  isPublished?: boolean;
  version?: number;
  media?: Array<{
    url: string;
    altText?: string;
    isThumbnail?: boolean;
    id?: string;
  }>;
  inventoryQuantity?: number;
  availableStock?: number;
  createdAt: string;
  updatedAt: string;
}

function normalizeProduct(p: RawProductResponse): AdminProduct {
  const mediaList = Array.isArray(p.media)
    ? p.media.map((m, idx) => ({
        id: m.id || String(idx),
        url: m.url || '',
        thumbnailUrl: m.url || '',
        isPrimary: m.isThumbnail ?? idx === 0,
      }))
    : [];

  return {
    id: p.id,
    title: p.title || 'Untitled',
    sku: p.sku || '',
    description: p.description || '',
    priceCents: p.unitPrice ?? p.priceCents ?? 0,
    currency: p.currency || 'BDT',
    categoryId: p.categoryId || p.category?.id || undefined,
    categoryName: p.category?.name || p.categoryName || 'Uncategorized',
    status: p.status || (p.isPublished ? 'active' : 'draft'),
    isPublished: p.status === 'active' || p.isPublished === true,
    version: p.version ?? 1,
    media: mediaList,
    availableStock: p.inventoryQuantity ?? p.availableStock ?? 0,
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
  };
}

export function useProducts(
  params: {
    page?: number;
    limit?: number;
    search?: string;
    status?: string;
  } = {},
) {
  const queryClient = useQueryClient();
  const page = params.page || 1;
  const limit = params.limit || 10;
  const search = params.search || undefined;
  const status = params.status || 'all';

  const productsQuery = useQuery<{
    products: AdminProduct[];
    total: number;
    page: number;
    totalPages: number;
  }>({
    queryKey: ['admin-products', page, limit, search, status],
    queryFn: async (): Promise<{
      products: AdminProduct[];
      total: number;
      page: number;
      totalPages: number;
    }> => {
      const res = await apiClient<
        | {
            data?: RawProductResponse[];
            products?: RawProductResponse[];
            meta?: { total?: number; page?: number; totalPages?: number };
            total?: number;
            page?: number;
            totalPages?: number;
          }
        | RawProductResponse[]
      >('/api/products', {
        params: { page, limit, search, status },
      });

      let rawList: RawProductResponse[] = [];
      let total = 0;
      let resPage = page;
      let totalPages = 1;

      if (Array.isArray(res)) {
        rawList = res;
        total = res.length;
        totalPages = Math.max(1, Math.ceil(total / limit));
      } else if (res && typeof res === 'object') {
        rawList = res.data || res.products || [];
        total = res.meta?.total ?? res.total ?? rawList.length;
        resPage = res.meta?.page ?? res.page ?? page;
        totalPages =
          res.meta?.totalPages ??
          res.totalPages ??
          Math.max(1, Math.ceil(total / limit));
      }

      return {
        products: rawList.map(normalizeProduct),
        total,
        page: resPage,
        totalPages,
      };
    },
  });

  const createProduct = useMutation({
    mutationFn: async (data: CreateProductInput | FormData) => {
      let body: BodyInit;
      if (typeof FormData !== 'undefined' && data instanceof FormData) {
        body = data;
      } else {
        const input = data as CreateProductInput;
        const unitPrice =
          input.priceBDT !== undefined
            ? Math.round(input.priceBDT * 100)
            : (input.priceCents ?? 0);

        body = JSON.stringify({
          title: input.title,
          sku: input.sku,
          description: input.description || '',
          unitPrice,
          currency: input.currency || 'BDT',
          categoryId: input.categoryId || undefined,
          status: input.isPublished ? 'active' : 'draft',
          inventoryQuantity: input.inventoryQuantity ?? 0,
          trackQuantity: true,
        });
      }

      return apiClient('/api/products', {
        method: 'POST',
        body,
      });
    },
    onSuccess: () => {
      toast.success('Product created successfully');
      queryClient.invalidateQueries({ queryKey: ['admin-products'] });
      queryClient.invalidateQueries({ queryKey: ['store-products'] });
    },
  });

  const updateProduct = useMutation({
    mutationFn: async ({ id, ...data }: UpdateProductInput) => {
      const unitPrice =
        data.priceBDT !== undefined
          ? Math.round(data.priceBDT * 100)
          : data.priceCents;

      return apiClient(`/api/products/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          title: data.title,
          description: data.description,
          unitPrice,
          categoryId: data.categoryId || undefined,
          status:
            data.isPublished !== undefined
              ? data.isPublished
                ? 'active'
                : 'draft'
              : undefined,
          inventoryQuantity: data.inventoryQuantity,
        }),
      });
    },
    onSuccess: () => {
      toast.success('Product updated successfully');
      queryClient.invalidateQueries({ queryKey: ['admin-products'] });
      queryClient.invalidateQueries({ queryKey: ['store-products'] });
    },
  });

  const deleteProduct = useMutation({
    mutationFn: async (id: string) => {
      return apiClient(`/api/products/${id}`, {
        method: 'DELETE',
      });
    },
    onSuccess: () => {
      toast.success('Product deleted');
      queryClient.invalidateQueries({ queryKey: ['admin-products'] });
      queryClient.invalidateQueries({ queryKey: ['store-products'] });
    },
  });

  return {
    products: productsQuery.data?.products || [],
    total: productsQuery.data?.total || 0,
    page: productsQuery.data?.page || page,
    totalPages: productsQuery.data?.totalPages || 1,
    isLoading: productsQuery.isLoading,
    refetch: productsQuery.refetch,
    createProduct: createProduct.mutateAsync,
    isCreating: createProduct.isPending,
    updateProduct: updateProduct.mutateAsync,
    isUpdating: updateProduct.isPending,
    deleteProduct: deleteProduct.mutateAsync,
    isDeleting: deleteProduct.isPending,
  };
}

export function useProduct(id: string) {
  return useQuery<AdminProduct>({
    queryKey: ['admin-product', id],
    queryFn: async () => {
      const res = await apiClient<RawProductResponse>(`/api/products/${id}`);
      return normalizeProduct(res);
    },
    enabled: Boolean(id),
  });
}
