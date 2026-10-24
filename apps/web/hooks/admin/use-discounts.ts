'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { apiClient } from '@/lib/api-client';

export interface DiscountRule {
  id: string;
  code: string;
  type: 'percentage' | 'fixed';
  value: number; // e.g. 15 for 15% or 50000 cents for ৳500
  minSpendCents?: number;
  maxDiscountCents?: number;
  usageLimit?: number;
  usageCount: number;
  startsAt?: string;
  endsAt?: string;
  isActive: boolean;
  createdAt: string;
}

export function useDiscounts() {
  const queryClient = useQueryClient();

  const discountsQuery = useQuery<DiscountRule[]>({
    queryKey: ['admin-discounts'],
    queryFn: async (): Promise<DiscountRule[]> => {
      const res = await apiClient<{ data?: DiscountRule[] } | DiscountRule[]>(
        '/api/admin/discounts',
      );
      if (Array.isArray(res)) return res;
      return Array.isArray(res?.data) ? res.data : [];
    },
  });

  const createDiscount = useMutation({
    mutationFn: async (data: {
      code: string;
      type: 'percentage' | 'fixed';
      value: number;
      minSpendCents?: number;
      maxDiscountCents?: number;
      usageLimit?: number;
      startsAt?: string;
      endsAt?: string;
    }) => {
      return apiClient('/api/admin/discounts', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => {
      toast.success('Discount coupon created');
      queryClient.invalidateQueries({ queryKey: ['admin-discounts'] });
    },
  });

  const activateDiscount = useMutation({
    mutationFn: async (id: string) => {
      return apiClient(`/api/admin/discounts/${id}/activate`, {
        method: 'PATCH',
      });
    },
    onSuccess: () => {
      toast.success('Coupon activated');
      queryClient.invalidateQueries({ queryKey: ['admin-discounts'] });
    },
  });

  const deactivateDiscount = useMutation({
    mutationFn: async (id: string) => {
      return apiClient(`/api/admin/discounts/${id}/deactivate`, {
        method: 'PATCH',
      });
    },
    onSuccess: () => {
      toast.success('Coupon deactivated');
      queryClient.invalidateQueries({ queryKey: ['admin-discounts'] });
    },
  });

  return {
    discounts: discountsQuery.data || [],
    isLoading: discountsQuery.isLoading,
    createDiscount: createDiscount.mutateAsync,
    isCreating: createDiscount.isPending,
    activateDiscount: activateDiscount.mutateAsync,
    deactivateDiscount: deactivateDiscount.mutateAsync,
  };
}
