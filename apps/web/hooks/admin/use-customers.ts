'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { apiClient } from '@/lib/api-client';

export interface AdminCustomerListItem {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  fullName: string;
  phoneNumber: string | null;
  avatarUrl: string | null;
  isActive: boolean;
  isEmailVerified: boolean;
  isGoogleLinked: boolean;
  totalOrders: number;
  totalSpentCents: number;
  totalSpentBDT: number;
  currency: string;
  lastOrderAt: string | null;
  createdAt: string;
}

export interface AdminCustomerAddress {
  recipientName: string;
  recipientPhone: string;
  altPhone?: string | null;
  division: string;
  district: string;
  city: string;
  area: string;
  addressLine: string;
  postalCode?: string | null;
  country: string;
  lastUsedAt: string;
}

export interface AdminCustomerOrderSummary {
  id: string;
  status: string;
  totalAmount: number;
  totalAmountBDT: number;
  totalCurrency: string;
  itemsCount: number;
  createdAt: string;
}

export interface AdminCustomerStats {
  totalOrders: number;
  totalSpentCents: number;
  totalSpentBDT: number;
  currency: string;
  completedOrders: number;
  cancelledOrders: number;
  averageOrderValueBDT: number;
  lastOrderAt: string | null;
}

export interface AdminCustomerDetails {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  fullName: string;
  phoneNumber: string | null;
  avatarUrl: string | null;
  isActive: boolean;
  isEmailVerified: boolean;
  isGoogleLinked: boolean;
  version: number;
  lastLoginAt: string | null;
  createdAt: string;
  updatedAt: string;
  stats: AdminCustomerStats;
  addresses: AdminCustomerAddress[];
  recentOrders: AdminCustomerOrderSummary[];
}

export interface ListCustomersParams {
  page?: number;
  limit?: number;
  search?: string;
  isActive?: boolean;
}

export interface AdminCustomersResult {
  customers: AdminCustomerListItem[];
  total: number;
  page: number;
  totalPages: number;
}

export function useCustomers(params: ListCustomersParams = {}) {
  const queryClient = useQueryClient();
  const page = params.page || 1;
  const limit = params.limit || 10;
  const search = params.search || undefined;
  const isActive = params.isActive;

  const customersQuery = useQuery<AdminCustomersResult>({
    queryKey: ['admin-customers', page, limit, search, isActive],
    queryFn: async (): Promise<AdminCustomersResult> => {
      const res = await apiClient<{
        data: AdminCustomerListItem[];
        meta: { total: number; page: number; totalPages: number };
      }>('/api/admin/customers', {
        params: {
          page,
          limit,
          search,
          isActive: isActive !== undefined ? String(isActive) : undefined,
        },
      });

      return {
        customers: res?.data || [],
        total: res?.meta?.total ?? (res?.data?.length || 0),
        page: res?.meta?.page ?? page,
        totalPages: res?.meta?.totalPages ?? 1,
      };
    },
  });

  const activateCustomer = useMutation({
    mutationFn: async (id: string) => {
      return apiClient(`/api/admin/customers/${id}/activate`, {
        method: 'PATCH',
      });
    },
    onSuccess: () => {
      toast.success('Customer account activated successfully');
      queryClient.invalidateQueries({ queryKey: ['admin-customers'] });
      queryClient.invalidateQueries({ queryKey: ['admin-customer'] });
    },
  });

  const deactivateCustomer = useMutation({
    mutationFn: async (id: string) => {
      return apiClient(`/api/admin/customers/${id}/deactivate`, {
        method: 'PATCH',
      });
    },
    onSuccess: () => {
      toast.success('Customer account deactivated successfully');
      queryClient.invalidateQueries({ queryKey: ['admin-customers'] });
      queryClient.invalidateQueries({ queryKey: ['admin-customer'] });
    },
  });

  return {
    customers: customersQuery.data?.customers || [],
    total: customersQuery.data?.total || 0,
    page: customersQuery.data?.page || page,
    totalPages: customersQuery.data?.totalPages || 1,
    isLoading: customersQuery.isLoading,
    refetch: customersQuery.refetch,
    activateCustomer: activateCustomer.mutateAsync,
    isActivating: activateCustomer.isPending,
    deactivateCustomer: deactivateCustomer.mutateAsync,
    isDeactivating: deactivateCustomer.isPending,
  };
}

export function useCustomer(id: string) {
  const customerQuery = useQuery<AdminCustomerDetails | null>({
    queryKey: ['admin-customer', id],
    queryFn: async (): Promise<AdminCustomerDetails | null> => {
      if (!id) return null;
      const res = await apiClient<{ data: AdminCustomerDetails }>(
        `/api/admin/customers/${id}`,
      );
      return res?.data || null;
    },
    enabled: !!id,
  });

  return {
    customer: customerQuery.data,
    isLoading: customerQuery.isLoading,
    refetch: customerQuery.refetch,
  };
}
