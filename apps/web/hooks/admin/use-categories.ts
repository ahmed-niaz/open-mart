'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { apiClient } from '@/lib/api-client';

export interface Category {
  id: string;
  name: string;
  slug: string;
  description?: string;
  parentId?: string | null;
  isPublished: boolean;
  children?: Category[];
}

export interface RawCategoryResponse {
  id: string;
  name: string;
  slug: string;
  description?: string;
  parentId?: string | null;
  isActive?: boolean;
  isPublished?: boolean;
  children?: Category[];
}

export function useCategories() {
  const queryClient = useQueryClient();

  const categoriesQuery = useQuery<Category[]>({
    queryKey: ['admin-categories'],
    queryFn: async (): Promise<Category[]> => {
      const res = await apiClient<
        { data?: RawCategoryResponse[] } | RawCategoryResponse[]
      >('/api/categories', {
        params: { limit: 100 },
      });
      const rawList: RawCategoryResponse[] = Array.isArray(res)
        ? res
        : Array.isArray(res?.data)
          ? res.data
          : [];

      return rawList.map((c: RawCategoryResponse) => ({
        id: c.id,
        name: c.name,
        slug: c.slug,
        description: c.description || '',
        parentId: c.parentId || null,
        isPublished: c.isActive !== false,
        children: c.children || [],
      }));
    },
  });

  const createCategory = useMutation({
    mutationFn: async (data: {
      name: string;
      description?: string;
      parentId?: string | null;
      isPublished?: boolean;
    }) => {
      return apiClient('/api/categories', {
        method: 'POST',
        body: JSON.stringify({
          name: data.name,
          description: data.description,
          parentId: data.parentId || undefined,
          isActive: data.isPublished !== false,
        }),
      });
    },
    onSuccess: () => {
      toast.success('Category created successfully');
      queryClient.invalidateQueries({ queryKey: ['admin-categories'] });
    },
  });

  return {
    categories: categoriesQuery.data || [],
    isLoading: categoriesQuery.isLoading,
    createCategory: createCategory.mutateAsync,
    isCreating: createCategory.isPending,
  };
}
