'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ShoppingBag, Eye, EyeOff, ShieldCheck, ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';

import { apiClient } from '@/lib/api-client';
import type { AdminUser } from '@/hooks/admin/use-admin-auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader } from '@/components/ui/card';

const loginSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

type LoginFormData = z.infer<typeof loginSchema>;

function AdminLoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const [showPassword, setShowPassword] = React.useState(false);

  // Check for error in query string (from OAuth callback)
  React.useEffect(() => {
    const errorParam = searchParams.get('error');
    if (errorParam) {
      toast.error(decodeURIComponent(errorParam));
    }
  }, [searchParams]);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  });

  const loginMutation = useMutation({
    mutationFn: async (data: LoginFormData) => {
      return apiClient<{
        admin: AdminUser;
        accessToken: string;
        refreshToken: string;
      }>('/api/admin/auth/login', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },
    onSuccess: (data) => {
      if (data?.accessToken && typeof window !== 'undefined') {
        localStorage.setItem('admin_access_token', data.accessToken);
      }
      queryClient.setQueryData(['admin-auth-me'], data.admin);
      toast.success(`Welcome back, ${data.admin?.firstName || 'Admin'}!`);
      router.push('/admin');
    },
  });

  const onSubmit = (data: LoginFormData) => {
    loginMutation.mutate(data);
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-white p-4 sm:p-6">
      <div className="w-full max-w-md">
        {/* Back to storefront link */}
        <div className="mb-4 text-center">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#6B756D] hover:text-[#163A2B] transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to Public Storefront
          </Link>
        </div>

        {/* Brand identity header */}
        <div className="mb-6 flex flex-col items-center text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#163A2B] text-white shadow-md mb-3">
            <ShoppingBag className="h-7 w-7 text-[#FAF7F0]" />
          </div>
          <h1 className="text-2xl font-extrabold tracking-tight text-[#163A2B]">
            OPEN-MART
          </h1>
          <p className="text-xs font-semibold uppercase tracking-widest text-[#6B756D] mt-1">
            Store Administration Portal
          </p>
        </div>

        {/* Login form card */}
        <Card className="border border-[#E5E0D5] bg-white shadow-lg">
          <CardHeader className="pb-4 border-b border-[#E5E0D5]/60 text-center">
            <div className="flex items-center justify-center gap-1.5 text-xs font-semibold text-[#2F855A] mb-1">
              <ShieldCheck className="h-4 w-4" />
              <span>Authorized Personnel Only</span>
            </div>
            <h2 className="text-lg font-bold text-[#252A25]">
              Sign in to Dashboard
            </h2>
            <p className="text-xs text-[#6B756D]">
              Enter your administrative credentials to access the workspace
            </p>
          </CardHeader>

          <CardContent className="pt-6 space-y-4">
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <Input
                label="Admin Email"
                type="email"
                placeholder="admin@openmart.com"
                autoComplete="email"
                error={errors.email?.message}
                {...register('email')}
              />

              <div className="relative">
                <Input
                  label="Password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  autoComplete="current-password"
                  error={errors.password?.message}
                  rightIcon={
                    <button
                      type="button"
                      onClick={() => setShowPassword((prev) => !prev)}
                      className="cursor-pointer text-[#6B756D] hover:text-[#163A2B] transition-colors"
                    >
                      {showPassword ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </button>
                  }
                  {...register('password')}
                />
              </div>

              <div className="pt-2">
                <Button
                  type="submit"
                  variant="primary"
                  fullWidth
                  loading={loginMutation.isPending}
                >
                  Sign In to Admin Workspace
                </Button>
              </div>
            </form>

            {/* Registration option */}
            <div className="pt-2 text-center border-t border-[#E5E0D5]/70">
              <p className="text-xs text-[#6B756D]">
                Need to register an admin or initial setup?{' '}
                <Link
                  href="/admin/register"
                  className="font-bold text-[#163A2B] hover:underline"
                >
                  Register Admin
                </Link>
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default function AdminLoginPage() {
  return (
    <React.Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-[#FAF7F0]">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#163A2B] border-t-transparent" />
        </div>
      }
    >
      <AdminLoginForm />
    </React.Suspense>
  );
}
