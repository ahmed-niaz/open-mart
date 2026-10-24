'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { apiClient } from '@/lib/api-client';

export interface AdminPayment {
  id: string;
  orderId: string;
  amountCents: number;
  currency: string;
  provider: 'stripe' | 'sslcommerz' | 'cod';
  status:
    'pending' | 'completed' | 'failed' | 'refunded' | 'partially_refunded';
  refundedAmountCents: number;
  gatewayTransactionId?: string;
  createdAt: string;
  updatedAt: string;
}

export function usePayments() {
  const queryClient = useQueryClient();

  const paymentsQuery = useQuery<AdminPayment[]>({
    queryKey: ['admin-payments'],
    queryFn: async (): Promise<AdminPayment[]> => {
      const res = await apiClient<{ data?: AdminPayment[] } | AdminPayment[]>(
        '/api/admin/payments',
      );
      if (Array.isArray(res)) return res;
      return Array.isArray(res?.data) ? res.data : [];
    },
  });

  const refundMutation = useMutation({
    mutationFn: async ({
      paymentId,
      amountCents,
      reason,
    }: {
      paymentId: string;
      amountCents: number;
      reason: string;
    }) => {
      return apiClient(`/api/admin/payments/${paymentId}/refund`, {
        method: 'POST',
        body: JSON.stringify({ amountCents, reason }),
      });
    },
    onSuccess: () => {
      toast.success('Payment refund initiated');
      queryClient.invalidateQueries({ queryKey: ['admin-payments'] });
      queryClient.invalidateQueries({ queryKey: ['admin-orders'] });
    },
  });

  return {
    payments: paymentsQuery.data || [],
    isLoading: paymentsQuery.isLoading,
    refundPayment: refundMutation.mutateAsync,
    isRefunding: refundMutation.isPending,
  };
}
