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
  parentName?: string;
  isPublished: boolean;
  children?: Category[];
}

export interface RawCategoryResponse {
  id: string;
  name: string;
  slug: string;
  description?: string;
  parentId?: string | null;
  parentName?: string;
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

      // Map to map for parentName lookup
      const nameMap = new Map<string, string>();
      rawList.forEach((c) => {
        if (c.id && c.name) nameMap.set(c.id, c.name);
      });

      return rawList.map((c: RawCategoryResponse) => ({
        id: c.id,
        name: c.name,
        slug: c.slug,
        description: c.description || '',
        parentId: c.parentId || null,
        parentName: c.parentId
          ? nameMap.get(c.parentId) || 'Parent Category'
          : undefined,
        isPublished: c.isActive !== false,
        children: c.children || [],
      }));
    },
  });

  const invalidateCategoryQueries = async () => {
    await Promise.all([
      queryClient.invalidateQueries({
        queryKey: ['admin-categories'],
        refetchType: 'all',
      }),
      queryClient.invalidateQueries({
        queryKey: ['storefront-categories-tree'],
        refetchType: 'all',
      }),
      queryClient.invalidateQueries({
        queryKey: ['admin-products'],
        refetchType: 'all',
      }),
      queryClient.invalidateQueries({
        queryKey: ['admin-product'],
        refetchType: 'all',
      }),
    ]);
  };

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
    onSuccess: async () => {
      toast.success('Category created successfully');
      await invalidateCategoryQueries();
    },
  });

  const updateCategory = useMutation({
    mutationFn: async (data: {
      id: string;
      name?: string;
      description?: string;
      parentId?: string | null;
      isPublished?: boolean;
    }) => {
      return apiClient(`/api/categories/${data.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          name: data.name,
          description: data.description,
          parentId: data.parentId === '' ? null : data.parentId,
          isActive: data.isPublished,
        }),
      });
    },
    onSuccess: async () => {
      toast.success('Category updated successfully');
      await invalidateCategoryQueries();
    },
  });

  const deleteCategory = useMutation({
    mutationFn: async (id: string) => {
      return apiClient(`/api/categories/${id}`, {
        method: 'DELETE',
      });
    },
    onSuccess: async () => {
      toast.success('Category deleted successfully');
      await invalidateCategoryQueries();
    },
  });

  const toggleCategoryStatus = useMutation({
    mutationFn: async ({
      id,
      isPublished,
    }: {
      id: string;
      isPublished: boolean;
    }) => {
      return apiClient(
        `/api/categories/${id}/${isPublished ? 'activate' : 'deactivate'}`,
        {
          method: 'PATCH',
        },
      );
    },
    onSuccess: async () => {
      toast.success('Category status updated');
      await invalidateCategoryQueries();
    },
  });

  return {
    categories: categoriesQuery.data || [],
    isLoading: categoriesQuery.isLoading,
    createCategory: createCategory.mutateAsync,
    isCreating: createCategory.isPending,
    updateCategory: updateCategory.mutateAsync,
    isUpdating: updateCategory.isPending,
    deleteCategory: deleteCategory.mutateAsync,
    isDeleting: deleteCategory.isPending,
    toggleCategoryStatus: toggleCategoryStatus.mutateAsync,
    isToggling: toggleCategoryStatus.isPending,
  };
}
