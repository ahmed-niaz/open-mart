'use client';

import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';

export interface AnalyticsSummary {
  period: string;
  totalRevenue: number;
  revenueChange?: number;
  totalOrders: number;
  ordersChange?: number;
  averageOrderValue: number;
  aovChange?: number;
  conversionRate?: number;
  conversionChange?: number;
}

export interface SalesChartPoint {
  date: string;
  revenue: number;
  ordersCount: number;
}

export interface OrderStatusStat {
  status: string;
  count: number;
}

export interface TopProduct {
  productId: string;
  productName: string;
  sku: string;
  totalQuantity: number;
  totalRevenue: number;
}

export interface InventoryHealth {
  healthyCount: number;
  lowStockCount: number;
  outOfStockCount: number;
  lowStockItems: Array<{
    sku: string;
    productName: string;
    availableStock: number;
    reorderPoint: number;
  }>;
}

export function useAnalytics(period: string = '30d') {
  const summaryQuery = useQuery<AnalyticsSummary>({
    queryKey: ['analytics-summary', period],
    queryFn: async (): Promise<AnalyticsSummary> => {
      const res = await apiClient<
        { data?: AnalyticsSummary } | AnalyticsSummary
      >('/api/admin/analytics/summary', { params: { period } });
      if (res && typeof res === 'object' && 'data' in res && res.data)
        return res.data;
      return res as AnalyticsSummary;
    },
  });

  const salesChartQuery = useQuery<SalesChartPoint[]>({
    queryKey: ['analytics-sales-chart', period],
    queryFn: async (): Promise<SalesChartPoint[]> => {
      const res = await apiClient<
        { data?: SalesChartPoint[] } | SalesChartPoint[]
      >('/api/admin/analytics/sales-chart', {
        params: { period, interval: period === 'today' ? 'hour' : 'day' },
      });
      if (Array.isArray(res)) return res;
      return Array.isArray(res?.data) ? res.data : [];
    },
  });

  const orderStatusQuery = useQuery<OrderStatusStat[]>({
    queryKey: ['analytics-order-status', period],
    queryFn: async (): Promise<OrderStatusStat[]> => {
      const res = await apiClient<
        { data?: OrderStatusStat[] } | OrderStatusStat[]
      >('/api/admin/analytics/order-status', { params: { period } });
      if (Array.isArray(res)) return res;
      return Array.isArray(res?.data) ? res.data : [];
    },
  });

  const topProductsQuery = useQuery<TopProduct[]>({
    queryKey: ['analytics-top-products'],
    queryFn: async (): Promise<TopProduct[]> => {
      const res = await apiClient<{ data?: TopProduct[] } | TopProduct[]>(
        '/api/admin/analytics/top-products',
        { params: { limit: 5 } },
      );
      if (Array.isArray(res)) return res;
      return Array.isArray(res?.data) ? res.data : [];
    },
  });

  const inventoryHealthQuery = useQuery<InventoryHealth>({
    queryKey: ['analytics-inventory-health'],
    queryFn: async (): Promise<InventoryHealth> => {
      const res = await apiClient<{ data?: InventoryHealth } | InventoryHealth>(
        '/api/admin/analytics/inventory-health',
      );
      if (res && typeof res === 'object' && 'data' in res && res.data)
        return res.data;
      return res as InventoryHealth;
    },
  });

  return {
    summary: summaryQuery.data,
    isLoadingSummary: summaryQuery.isLoading,
    salesChart: salesChartQuery.data || [],
    isLoadingSalesChart: salesChartQuery.isLoading,
    orderStatus: orderStatusQuery.data || [],
    isLoadingOrderStatus: orderStatusQuery.isLoading,
    topProducts: topProductsQuery.data || [],
    isLoadingTopProducts: topProductsQuery.isLoading,
    inventoryHealth: inventoryHealthQuery.data,
    isLoadingInventoryHealth: inventoryHealthQuery.isLoading,
    refetchAll: () => {
      summaryQuery.refetch();
      salesChartQuery.refetch();
      orderStatusQuery.refetch();
      topProductsQuery.refetch();
      inventoryHealthQuery.refetch();
    },
  };
}
