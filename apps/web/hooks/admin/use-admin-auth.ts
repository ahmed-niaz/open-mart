'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { apiClient } from '@/lib/api-client';

export interface AdminUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: 'super_admin' | 'operations' | 'finance' | 'support';
  status: 'active' | 'suspended' | 'deactivated';
  lastLoginAt?: string;
  mustChangePassword?: boolean;
}

export function useAdminAuth() {
  const queryClient = useQueryClient();
  const router = useRouter();

  // Query current logged-in admin profile
  const {
    data: admin,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery<AdminUser | null>({
    queryKey: ['admin-auth-me'],
    queryFn: async (): Promise<AdminUser | null> => {
      try {
        const response = await apiClient<{ data?: AdminUser } | AdminUser>(
          '/api/admin/auth/me',
          {
            skipErrorToast: true,
          },
        );
        if ('data' in response && response.data) {
          return response.data;
        }
        return response as AdminUser;
      } catch (err: unknown) {
        if ((err as { statusCode?: number })?.statusCode === 401) {
          return null;
        }
        throw err;
      }
    },
    staleTime: 1000 * 60 * 5, // 5 mins
    retry: false,
  });

  // Logout mutation
  const logoutMutation = useMutation({
    mutationFn: async () => {
      await apiClient('/api/admin/auth/logout', {
        method: 'POST',
        skipErrorToast: true,
      });
      if (typeof window !== 'undefined') {
        localStorage.removeItem('admin_access_token');
      }
    },
    onSuccess: () => {
      queryClient.setQueryData(['admin-auth-me'], null);
      queryClient.clear();
      toast.success('Logged out successfully');
      router.push('/admin/login');
    },
    onError: () => {
      if (typeof window !== 'undefined') {
        localStorage.removeItem('admin_access_token');
      }
      queryClient.setQueryData(['admin-auth-me'], null);
      router.push('/admin/login');
    },
  });

  return {
    admin,
    isAuthenticated: Boolean(admin),
    isLoading,
    isError,
    error,
    refetch,
    logout: logoutMutation.mutate,
    isLoggingOut: logoutMutation.isPending,
  };
}
