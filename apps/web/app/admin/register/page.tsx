'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  ShoppingBag,
  Eye,
  EyeOff,
  ShieldCheck,
  ArrowLeft,
  KeyRound,
  UserPlus,
} from 'lucide-react';
import { toast } from 'sonner';

import { apiClient } from '@/lib/api-client';
import type { AdminUser } from '@/hooks/admin/use-admin-auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader } from '@/components/ui/card';

const registerSchema = z.object({
  firstName: z.string().min(2, 'First name must be at least 2 characters'),
  lastName: z.string().min(1, 'Last name is required'),
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  phoneNumber: z.string().optional(),
  registrationSecret: z.string().optional(),
});

type RegisterFormData = z.infer<typeof registerSchema>;

export default function AdminRegisterPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [showPassword, setShowPassword] = React.useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<RegisterFormData>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      firstName: '',
      lastName: '',
      email: '',
      password: '',
      phoneNumber: '',
      registrationSecret: '',
    },
  });

  const registerMutation = useMutation({
    mutationFn: async (data: RegisterFormData) => {
      return apiClient<{
        admin: AdminUser;
        accessToken: string;
        refreshToken: string;
      }>('/api/admin/auth/register', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },
    onSuccess: (data) => {
      if (data?.accessToken && typeof window !== 'undefined') {
        localStorage.setItem('admin_access_token', data.accessToken);
      }
      queryClient.setQueryData(['admin-auth-me'], data.admin);
      toast.success(
        `Admin account registered! Welcome, ${data.admin?.firstName || 'Admin'}`,
      );
      router.push('/admin');
    },
  });

  const onSubmit = (data: RegisterFormData) => {
    registerMutation.mutate(data);
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-white p-4 sm:p-6">
      <div className="w-full max-w-lg">
        {/* Back link */}
        <div className="mb-4 text-center">
          <Link
            href="/admin/login"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#6B756D] hover:text-[#163A2B] transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to Admin Sign In
          </Link>
        </div>

        {/* Brand Header */}
        <div className="mb-6 flex flex-col items-center text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#163A2B] text-white shadow-md mb-3">
            <ShoppingBag className="h-7 w-7 text-[#FAF7F0]" />
          </div>
          <h1 className="text-2xl font-extrabold tracking-tight text-[#163A2B]">
            OPEN-MART
          </h1>
          <p className="text-xs font-semibold uppercase tracking-widest text-[#6B756D] mt-1">
            Administrator Registration
          </p>
        </div>

        {/* Registration Card */}
        <Card className="border border-[#E5E0D5] bg-white shadow-lg">
          <CardHeader className="pb-4 border-b border-[#E5E0D5]/60 text-center">
            <div className="flex items-center justify-center gap-1.5 text-xs font-semibold text-[#2F855A] mb-1">
              <ShieldCheck className="h-4 w-4" />
              <span>Privileged Account Setup</span>
            </div>
            <h2 className="text-lg font-bold text-[#252A25]">
              Create Administrator Profile
            </h2>
            <p className="text-xs text-[#6B756D]">
              Setup your administrative credentials to manage store operations
            </p>
          </CardHeader>

          <CardContent className="pt-6 space-y-4">
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Input
                  label="First Name *"
                  placeholder="e.g. Abdullah"
                  error={errors.firstName?.message}
                  {...register('firstName')}
                />
                <Input
                  label="Last Name *"
                  placeholder="e.g. Al-Mamun"
                  error={errors.lastName?.message}
                  {...register('lastName')}
                />
              </div>

              <Input
                label="Admin Email *"
                type="email"
                placeholder="admin@openmart.com"
                autoComplete="email"
                error={errors.email?.message}
                {...register('email')}
              />

              <div className="relative">
                <Input
                  label="Password *"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Min 8 characters with symbols"
                  autoComplete="new-password"
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

              <Input
                label="Phone Number (Optional)"
                placeholder="+880 1700 000000"
                error={errors.phoneNumber?.message}
                {...register('phoneNumber')}
              />

              <div className="rounded-xl border border-[#E5E0D5] bg-[#FAF7F0] p-3.5 space-y-2">
                <div className="flex items-center gap-1.5 text-xs font-bold text-[#163A2B]">
                  <KeyRound className="h-4 w-4 text-[#B7791F]" />
                  <span>Admin Registration Secret</span>
                </div>
                <Input
                  placeholder="Enter secret key (if applicable)"
                  type="password"
                  error={errors.registrationSecret?.message}
                  className="bg-white"
                  {...register('registrationSecret')}
                />
                <p className="text-[11px] text-[#6B756D] leading-relaxed">
                  ℹ️ If no super-admins exist in the database, this key is
                  optional and you will automatically become the initial Super
                  Admin. If admins already exist, enter your configured server
                  secret.
                </p>
              </div>

              <div className="pt-2">
                <Button
                  type="submit"
                  variant="primary"
                  fullWidth
                  loading={registerMutation.isPending}
                  leftIcon={<UserPlus className="h-4 w-4" />}
                >
                  Register Administrator
                </Button>
              </div>
            </form>

            <div className="pt-2 text-center border-t border-[#E5E0D5]/70">
              <p className="text-xs text-[#6B756D]">
                Already have an admin account?{' '}
                <Link
                  href="/admin/login"
                  className="font-bold text-[#163A2B] hover:underline"
                >
                  Sign In
                </Link>
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
