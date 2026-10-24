'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { apiClient } from '@/lib/api-client';
import type { AdminUser } from './use-admin-auth';

export function useAdminUsers() {
  const queryClient = useQueryClient();

  const usersQuery = useQuery<AdminUser[]>({
    queryKey: ['admin-users-list'],
    queryFn: async (): Promise<AdminUser[]> => {
      const res = await apiClient<{ data?: AdminUser[] } | AdminUser[]>(
        '/api/admin/users',
      );
      if (Array.isArray(res)) return res;
      return Array.isArray(res?.data) ? res.data : [];
    },
  });

  const createUser = useMutation({
    mutationFn: async (data: {
      email: string;
      firstName: string;
      lastName: string;
      role: string;
      password?: string;
    }) => {
      return apiClient('/api/admin/users', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => {
      toast.success('Admin staff member invited');
      queryClient.invalidateQueries({ queryKey: ['admin-users-list'] });
    },
  });

  const toggleStatus = useMutation({
    mutationFn: async ({
      id,
      status,
    }: {
      id: string;
      status: 'active' | 'suspended' | 'deactivated';
    }) => {
      const endpoint =
        status === 'active'
          ? `/api/admin/users/${id}/activate`
          : `/api/admin/users/${id}/deactivate`;
      return apiClient(endpoint, {
        method: 'PATCH',
        body: JSON.stringify({ reason: 'Admin dashboard state toggle' }),
      });
    },
    onSuccess: () => {
      toast.success('Admin status updated');
      queryClient.invalidateQueries({ queryKey: ['admin-users-list'] });
    },
  });

  return {
    users: usersQuery.data || [],
    isLoading: usersQuery.isLoading,
    createUser: createUser.mutateAsync,
    isCreating: createUser.isPending,
    toggleStatus: toggleStatus.mutateAsync,
  };
}
