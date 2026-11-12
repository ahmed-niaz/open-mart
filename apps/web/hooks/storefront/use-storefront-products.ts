'use client';

import { useQuery } from '@tanstack/react-query';

export interface StorefrontProductMedia {
  url: string;
  altText?: string;
  isThumbnail?: boolean;
}

export interface StorefrontProduct {
  id: string;
  title: string;
  description: string;
  media: StorefrontProductMedia[];
  tags: string[];
  status: string;
  categoryId?: string | null;
  category?: {
    id: string;
    name: string;
    slug: string;
  } | null;
  unitPrice: number;
  currency: string;
  compareAtPrice?: number;
  sku: string;
  inventoryQuantity: number;
  trackQuantity: boolean;
}

export interface StorefrontProductListResponse {
  data: StorefrontProduct[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export interface UseStorefrontProductsParams {
  search?: string;
  category?: string;
  minPrice?: number;
  maxPrice?: number;
  page?: number;
  limit?: number;
  enabled?: boolean;
}

async function fetchStorefrontProducts(
  params: Omit<UseStorefrontProductsParams, 'enabled'>,
): Promise<StorefrontProductListResponse> {
  const qs = new URLSearchParams();
  if (params.search?.trim()) qs.set('search', params.search.trim());
  if (params.category && params.category !== 'all') {
    qs.set('category', params.category);
  }
  if (params.minPrice !== undefined)
    qs.set('minPrice', String(params.minPrice));
  if (params.maxPrice !== undefined)
    qs.set('maxPrice', String(params.maxPrice));
  qs.set('page', String(params.page ?? 1));
  qs.set('limit', String(params.limit ?? 20));
  qs.set('status', 'active');

  const response = await fetch(`/api/products?${qs.toString()}`, {
    method: 'GET',
    cache: 'no-store',
    headers: {
      Accept: 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to search products (${response.status})`);
  }

  const payload = (await response.json()) as StorefrontProductListResponse;
  return {
    data: Array.isArray(payload?.data) ? payload.data : [],
    meta: payload?.meta ?? {
      total: 0,
      page: params.page ?? 1,
      limit: params.limit ?? 20,
      totalPages: 1,
    },
  };
}

export function useStorefrontProducts({
  search = '',
  category = 'all',
  minPrice,
  maxPrice,
  page = 1,
  limit = 20,
  enabled = true,
}: UseStorefrontProductsParams) {
  const normalizedSearch = search.trim();
  const normalizedCategory = category.trim() || 'all';

  return useQuery({
    queryKey: [
      'store-products',
      {
        search: normalizedSearch,
        category: normalizedCategory,
        minPrice: minPrice ?? null,
        maxPrice: maxPrice ?? null,
        page,
        limit,
      },
    ],
    queryFn: () =>
      fetchStorefrontProducts({
        search: normalizedSearch,
        category: normalizedCategory,
        minPrice,
        maxPrice,
        page,
        limit,
      }),
    enabled,
    staleTime: 1000 * 30,
  });
}
