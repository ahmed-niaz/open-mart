'use client';

import { useQuery } from '@tanstack/react-query';
import {
  FALLBACK_DEPARTMENTS,
  type StorefrontDepartment,
} from '@/components/storefront/header/nav-data';

export interface CategoryTreeApiNode {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  parentId?: string | null;
  imageUrl?: string | null;
  isActive?: boolean;
  displayOrder?: number;
  children?: CategoryTreeApiNode[];
}

function mapCategoryNode(node: CategoryTreeApiNode): StorefrontDepartment {
  const activeChildren = Array.isArray(node.children)
    ? node.children
        .filter((child) => child.isActive !== false)
        .sort(
          (a, b) =>
            (a.displayOrder ?? 0) - (b.displayOrder ?? 0) ||
            a.name.localeCompare(b.name),
        )
        .map(mapCategoryNode)
    : [];

  return {
    id: node.id,
    name: node.name,
    slug: node.slug,
    href: `/category/${encodeURIComponent(node.slug)}`,
    description: node.description ?? '',
    imageUrl: node.imageUrl ?? undefined,
    children: activeChildren,
  };
}

async function fetchStorefrontCategoryTree(): Promise<StorefrontDepartment[]> {
  const response = await fetch('/api/categories/tree', {
    method: 'GET',
    cache: 'no-store',
    headers: {
      Accept: 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to load departments (${response.status})`);
  }

  const payload: unknown = await response.json();
  const rawNodes: CategoryTreeApiNode[] = Array.isArray(payload)
    ? payload
    : Array.isArray((payload as { data?: CategoryTreeApiNode[] })?.data)
      ? (payload as { data: CategoryTreeApiNode[] }).data
      : [];

  return rawNodes
    .filter((node) => node.isActive !== false)
    .sort(
      (a, b) =>
        (a.displayOrder ?? 0) - (b.displayOrder ?? 0) ||
        a.name.localeCompare(b.name),
    )
    .map(mapCategoryNode);
}

/**
 * Fetches active hierarchical categories from GET /api/categories/tree
 * for storefront navigation bars and the Shop by Department drawer.
 */
export function useStorefrontCategories() {
  const query = useQuery<StorefrontDepartment[]>({
    queryKey: ['storefront-categories-tree'],
    queryFn: fetchStorefrontCategoryTree,
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });

  const departments =
    query.isError && !query.data ? FALLBACK_DEPARTMENTS : (query.data ?? []);

  return {
    departments,
    isLoading: query.isLoading,
    isError: query.isError,
    isFallback: Boolean(query.isError && !query.data),
    refetch: query.refetch,
  };
}
