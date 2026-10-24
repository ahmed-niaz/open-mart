'use client';

import * as React from 'react';
import { UserPlus, Shield, UserX, UserCheck } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

import { AdminPageHeader } from '@/components/admin/layout/admin-page-header';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { StatusBadge } from '@/components/ui/badge';
import { DataTable, type Column } from '@/components/ui/data-table';
import { Modal } from '@/components/ui/modal';
import { useAdminUsers } from '@/hooks/admin/use-admin-users';
import type { AdminUser } from '@/hooks/admin/use-admin-auth';
import { formatDate } from '@/lib/utils';

const userSchema = z.object({
  email: z.string().email('Valid email is required'),
  firstName: z.string().min(2, 'First name is required'),
  lastName: z.string().min(2, 'Last name is required'),
  role: z.enum(['super_admin', 'operations', 'finance', 'support']),
  password: z.string().min(8, 'Temporary password must be at least 8 chars'),
});

type UserFormData = z.infer<typeof userSchema>;

export default function AdminUsersPage() {
  const [isModalOpen, setIsModalOpen] = React.useState(false);
  const { users, isLoading, createUser, isCreating, toggleStatus } =
    useAdminUsers();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<UserFormData>({
    resolver: zodResolver(userSchema),
    defaultValues: {
      email: '',
      firstName: '',
      lastName: '',
      role: 'operations',
      password: '',
    },
  });

  const onSubmit = async (data: UserFormData) => {
    await createUser(data);
    reset();
    setIsModalOpen(false);
  };

  const columns: Column<AdminUser>[] = [
    {
      header: 'Staff Member',
      accessorKey: 'firstName',
      cell: (u) => (
        <div>
          <p className="font-semibold text-xs text-[#252A25]">
            {u.firstName} {u.lastName}
          </p>
          <p className="text-[11px] text-[#6B756D]">{u.email}</p>
        </div>
      ),
    },
    {
      header: 'RBAC Permission Role',
      accessorKey: 'role',
      cell: (u) => (
        <span className="inline-flex items-center gap-1 rounded-md border border-[#E5E0D5] bg-[#FAF7F0] px-2 py-0.5 text-[11px] font-bold uppercase text-[#163A2B]">
          <Shield className="h-3 w-3 text-[#2F855A]" />
          {u.role.replace('_', ' ')}
        </span>
      ),
    },
    {
      header: 'Account Status',
      accessorKey: 'status',
      cell: (u) => <StatusBadge status={u.status} />,
    },
    {
      header: 'Last Active Session',
      accessorKey: 'lastLoginAt',
      cell: (u) => (
        <span className="text-xs text-[#6B756D]">
          {formatDate(u.lastLoginAt)}
        </span>
      ),
    },
    {
      header: 'Action',
      align: 'right',
      cell: (u) => (
        <Button
          variant="outline"
          size="sm"
          fullWidth={false}
          onClick={() =>
            toggleStatus({
              id: u.id,
              status: u.status === 'active' ? 'suspended' : 'active',
            })
          }
        >
          {u.status === 'active' ? (
            <>
              <UserX className="h-3.5 w-3.5 text-[#C53030]" />
              Suspend
            </>
          ) : (
            <>
              <UserCheck className="h-3.5 w-3.5 text-[#267A46]" />
              Activate
            </>
          )}
        </Button>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Admin Team & Access Permissions"
        subtitle="Manage store administrators, operators, fulfillment agents, and accountants."
        breadcrumbs={[{ label: 'System' }, { label: 'Staff & Roles' }]}
        actions={
          <Button
            variant="primary"
            size="sm"
            fullWidth={false}
            onClick={() => {
              reset();
              setIsModalOpen(true);
            }}
            leftIcon={<UserPlus className="h-4 w-4" />}
          >
            Invite Staff Member
          </Button>
        }
      />

      <Card className="shadow-xs">
        <CardContent className="pt-5">
          <DataTable
            columns={columns}
            data={users}
            isLoading={isLoading}
            emptyMessage="No staff users found."
          />
        </CardContent>
      </Card>

      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Invite New Administrator"
        description="Assign RBAC roles and credentials for staff access"
        footer={
          <div className="flex w-full items-center gap-2">
            <Button
              type="button"
              variant="outline"
              fullWidth
              onClick={() => setIsModalOpen(false)}
              disabled={isCreating}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              form="user-form"
              variant="primary"
              fullWidth
              loading={isCreating}
            >
              Grant Access
            </Button>
          </div>
        }
      >
        <form
          id="user-form"
          onSubmit={handleSubmit(onSubmit)}
          className="space-y-4 py-2"
        >
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="First Name *"
              placeholder="e.g. Rahim"
              error={errors.firstName?.message}
              {...register('firstName')}
            />
            <Input
              label="Last Name *"
              placeholder="e.g. Ahmed"
              error={errors.lastName?.message}
              {...register('lastName')}
            />
          </div>

          <Input
            label="Work Email *"
            type="email"
            placeholder="rahim@openmart.com"
            error={errors.email?.message}
            {...register('email')}
          />

          <Select
            label="Security Role *"
            error={errors.role?.message}
            {...register('role')}
            options={[
              {
                label: 'Operations (Fulfill & Ship Orders)',
                value: 'operations',
              },
              {
                label: 'Finance (Refunds & Financial Reports)',
                value: 'finance',
              },
              { label: 'Support (View Orders & Customers)', value: 'support' },
              {
                label: 'Super Admin (Full Administrative Authority)',
                value: 'super_admin',
              },
            ]}
          />

          <Input
            label="Temporary Password *"
            type="password"
            placeholder="Min 8 characters"
            error={errors.password?.message}
            {...register('password')}
          />
        </form>
      </Modal>
    </div>
  );
}
