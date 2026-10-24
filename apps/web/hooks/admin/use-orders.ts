'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { apiClient } from '@/lib/api-client';

export interface OrderItem {
  id: string;
  productId: string;
  productName: string;
  productSku: string;
  unitPriceAmount: number;
  quantity: number;
  subtotalAmount: number;
}

export interface ShippingAddress {
  recipientName: string;
  recipientPhone: string;
  division: string;
  district: string;
  city: string;
  area: string;
  addressLine: string;
  postalCode?: string;
  country?: string;
}

export interface AdminOrder {
  id: string;
  orderNumber: string;
  customerId: string;
  customerName?: string;
  customerPhone?: string;
  customerEmail?: string;
  status:
    | 'pending'
    | 'confirmed'
    | 'processing'
    | 'shipped'
    | 'delivered'
    | 'cancelled'
    | 'returned';
  subtotalAmount: number;
  shippingFeeAmount: number;
  shippingFeeDiscountAmount: number;
  taxAmount: number;
  totalAmount: number;
  currency: string;
  paymentMethod?: 'cod' | 'stripe' | 'sslcommerz';
  paymentStatus?: 'pending' | 'completed' | 'failed' | 'refunded';
  carrier?: string;
  trackingNumber?: string;
  shippingAddress: ShippingAddress;
  items: OrderItem[];
  createdAt: string;
  updatedAt: string;
}

export interface ListOrdersParams {
  page?: number;
  limit?: number;
  status?: string;
  customerId?: string;
}

export interface AdminOrdersResult {
  orders: AdminOrder[];
  total: number;
  page: number;
  totalPages: number;
}

export function useOrders(params: ListOrdersParams = {}) {
  const queryClient = useQueryClient();
  const page = params.page || 1;
  const limit = params.limit || 10;
  const status = params.status || undefined;

  const ordersQuery = useQuery<AdminOrdersResult>({
    queryKey: ['admin-orders', page, limit, status],
    queryFn: async (): Promise<AdminOrdersResult> => {
      const res = await apiClient<
        | {
            data?: AdminOrder[];
            orders?: AdminOrder[];
            total?: number;
            page?: number;
            totalPages?: number;
          }
        | AdminOrder[]
      >('/api/admin/orders', {
        params: {
          page,
          limit,
          status: status === 'all' ? undefined : status,
          customerId: params.customerId,
        },
      });

      // Normalize pagination response
      if (Array.isArray(res)) {
        const orderList = res as unknown as AdminOrder[];
        return {
          orders: orderList,
          total: orderList.length,
          page,
          totalPages: Math.max(1, Math.ceil(orderList.length / limit)),
        };
      }
      if (
        res &&
        typeof res === 'object' &&
        'data' in res &&
        Array.isArray(res.data)
      ) {
        return {
          orders: res.data,
          total: res.total ?? res.data.length,
          page: res.page ?? page,
          totalPages:
            res.totalPages ??
            Math.max(1, Math.ceil((res.total ?? res.data.length) / limit)),
        };
      }
      if (
        res &&
        typeof res === 'object' &&
        'orders' in res &&
        Array.isArray(res.orders)
      ) {
        return {
          orders: res.orders,
          total: res.total ?? res.orders.length,
          page: res.page ?? page,
          totalPages:
            res.totalPages ??
            Math.max(1, Math.ceil((res.total ?? res.orders.length) / limit)),
        };
      }
      return { orders: [], total: 0, page: 1, totalPages: 1 };
    },
  });

  // Mutate Order Status Actions
  const confirmOrder = useMutation({
    mutationFn: async (orderId: string) => {
      return apiClient(`/api/admin/orders/${orderId}/confirm`, {
        method: 'PATCH',
      });
    },
    onSuccess: () => {
      toast.success('Order confirmed successfully');
      queryClient.invalidateQueries({ queryKey: ['admin-orders'] });
      queryClient.invalidateQueries({ queryKey: ['analytics-summary'] });
    },
  });

  const processOrder = useMutation({
    mutationFn: async (orderId: string) => {
      return apiClient(`/api/admin/orders/${orderId}/process`, {
        method: 'PATCH',
      });
    },
    onSuccess: () => {
      toast.success('Order marked as processing');
      queryClient.invalidateQueries({ queryKey: ['admin-orders'] });
    },
  });

  const shipOrder = useMutation({
    mutationFn: async ({
      orderId,
      carrier,
      trackingNumber,
    }: {
      orderId: string;
      carrier: string;
      trackingNumber?: string;
    }) => {
      return apiClient(`/api/admin/orders/${orderId}/ship`, {
        method: 'PATCH',
        body: JSON.stringify({ carrier, trackingNumber }),
      });
    },
    onSuccess: () => {
      toast.success('Order marked as shipped');
      queryClient.invalidateQueries({ queryKey: ['admin-orders'] });
    },
  });

  const deliverOrder = useMutation({
    mutationFn: async (orderId: string) => {
      return apiClient(`/api/admin/orders/${orderId}/deliver`, {
        method: 'PATCH',
      });
    },
    onSuccess: () => {
      toast.success('Order marked as delivered');
      queryClient.invalidateQueries({ queryKey: ['admin-orders'] });
      queryClient.invalidateQueries({ queryKey: ['analytics-summary'] });
    },
  });

  const cancelOrder = useMutation({
    mutationFn: async ({
      orderId,
      reason,
    }: {
      orderId: string;
      reason: string;
    }) => {
      return apiClient(`/api/admin/orders/${orderId}/cancel`, {
        method: 'PATCH',
        body: JSON.stringify({ reason }),
      });
    },
    onSuccess: () => {
      toast.success('Order cancelled successfully');
      queryClient.invalidateQueries({ queryKey: ['admin-orders'] });
      queryClient.invalidateQueries({ queryKey: ['analytics-summary'] });
    },
  });

  return {
    orders: ordersQuery.data?.orders || [],
    total: ordersQuery.data?.total || 0,
    page: ordersQuery.data?.page || page,
    totalPages: ordersQuery.data?.totalPages || 1,
    isLoading: ordersQuery.isLoading,
    refetch: ordersQuery.refetch,
    confirmOrder: confirmOrder.mutateAsync,
    isConfirming: confirmOrder.isPending,
    processOrder: processOrder.mutateAsync,
    isProcessing: processOrder.isPending,
    shipOrder: shipOrder.mutateAsync,
    isShipping: shipOrder.isPending,
    deliverOrder: deliverOrder.mutateAsync,
    isDelivering: deliverOrder.isPending,
    cancelOrder: cancelOrder.mutateAsync,
    isCancelling: cancelOrder.isPending,
  };
}
