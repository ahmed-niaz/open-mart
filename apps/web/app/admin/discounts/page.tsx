'use client';

import * as React from 'react';
import { Plus, Tag, ToggleLeft, ToggleRight } from 'lucide-react';
import { useForm, useWatch } from 'react-hook-form';
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
import { useDiscounts, type DiscountRule } from '@/hooks/admin/use-discounts';
import { formatBDT } from '@/lib/utils';

const discountSchema = z.object({
  code: z.string().min(3, 'Code must be at least 3 characters'),
  type: z.enum(['percentage', 'fixed']),
  value: z.number().positive('Value must be positive'),
  minSpendBDT: z.number().optional(),
  maxDiscountBDT: z.number().optional(),
  usageLimit: z.number().optional(),
});

type DiscountFormData = z.infer<typeof discountSchema>;

export default function AdminDiscountsPage() {
  const [isModalOpen, setIsModalOpen] = React.useState(false);
  const {
    discounts,
    isLoading,
    createDiscount,
    isCreating,
    activateDiscount,
    deactivateDiscount,
  } = useDiscounts();

  const {
    register,
    handleSubmit,
    reset,
    control,
    formState: { errors },
  } = useForm<DiscountFormData>({
    resolver: zodResolver(discountSchema),
    defaultValues: {
      code: '',
      type: 'percentage',
      value: 10,
    },
  });

  const selectedType = useWatch({ control, name: 'type' });

  const onSubmit = async (data: DiscountFormData) => {
    await createDiscount({
      code: data.code,
      type: data.type,
      value:
        data.type === 'percentage' ? data.value : Math.round(data.value * 100),
      minSpendCents: data.minSpendBDT
        ? Math.round(data.minSpendBDT * 100)
        : undefined,
      maxDiscountCents: data.maxDiscountBDT
        ? Math.round(data.maxDiscountBDT * 100)
        : undefined,
      usageLimit: data.usageLimit || undefined,
    });
    reset();
    setIsModalOpen(false);
  };

  const columns: Column<DiscountRule>[] = [
    {
      header: 'Coupon Code',
      accessorKey: 'code',
      cell: (rule) => (
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#FAF7F0] border border-[#E5E0D5] text-[#163A2B]">
            <Tag className="h-4 w-4" />
          </div>
          <span className="font-mono font-bold text-xs tracking-wider text-[#163A2B]">
            {rule.code}
          </span>
        </div>
      ),
    },
    {
      header: 'Discount Offer',
      accessorKey: 'value',
      cell: (rule) => (
        <span className="font-semibold text-xs text-[#252A25]">
          {rule.type === 'percentage'
            ? `${rule.value}% OFF`
            : `${formatBDT(rule.value)} FLAT OFF`}
        </span>
      ),
    },
    {
      header: 'Redemptions',
      accessorKey: 'usageCount',
      cell: (rule) => (
        <span className="text-xs text-[#6B756D]">
          {rule.usageCount}{' '}
          {rule.usageLimit ? `/ ${rule.usageLimit} uses` : 'uses'}
        </span>
      ),
    },
    {
      header: 'Minimum Spend',
      accessorKey: 'minSpendCents',
      cell: (rule) => (
        <span className="text-xs text-[#6B756D]">
          {rule.minSpendCents ? formatBDT(rule.minSpendCents) : 'No Minimum'}
        </span>
      ),
    },
    {
      header: 'Status',
      accessorKey: 'isActive',
      cell: (rule) => (
        <StatusBadge status={rule.isActive ? 'Active' : 'Inactive'} />
      ),
    },
    {
      header: 'Toggle',
      align: 'right',
      cell: (rule) => (
        <Button
          variant="outline"
          size="sm"
          fullWidth={false}
          onClick={() =>
            rule.isActive
              ? deactivateDiscount(rule.id)
              : activateDiscount(rule.id)
          }
        >
          {rule.isActive ? (
            <ToggleRight className="h-4 w-4 text-[#267A46]" />
          ) : (
            <ToggleLeft className="h-4 w-4 text-[#6B756D]" />
          )}
          {rule.isActive ? 'Active' : 'Paused'}
        </Button>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Promotions & Discount Codes"
        subtitle="Create percentage or flat discount vouchers with minimum spend and redemption thresholds."
        breadcrumbs={[{ label: 'Marketing' }, { label: 'Discounts' }]}
        actions={
          <Button
            variant="primary"
            size="sm"
            fullWidth={false}
            onClick={() => {
              reset();
              setIsModalOpen(true);
            }}
            leftIcon={<Plus className="h-4 w-4" />}
          >
            Create Coupon
          </Button>
        }
      />

      <Card className="shadow-xs">
        <CardContent className="pt-5">
          <DataTable
            columns={columns}
            data={discounts}
            isLoading={isLoading}
            emptyMessage="No discount campaigns created yet."
          />
        </CardContent>
      </Card>

      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Create Promotional Coupon"
        description="Configure discount rules, threshold conditions, and coupon code"
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
              form="discount-form"
              variant="primary"
              fullWidth
              loading={isCreating}
            >
              Create Campaign
            </Button>
          </div>
        }
      >
        <form
          id="discount-form"
          onSubmit={handleSubmit(onSubmit)}
          className="space-y-4 py-2"
        >
          <Input
            label="Coupon Code *"
            placeholder="e.g. SUMMER25"
            error={errors.code?.message}
            {...register('code')}
          />

          <div className="grid grid-cols-2 gap-3">
            <Select
              label="Discount Type *"
              error={errors.type?.message}
              {...register('type')}
              options={[
                { label: 'Percentage (%)', value: 'percentage' },
                { label: 'Fixed Amount (৳)', value: 'fixed' },
              ]}
            />

            <Input
              label={
                selectedType === 'percentage'
                  ? 'Percent Off (%) *'
                  : 'Amount Off (BDT ৳) *'
              }
              type="number"
              step="1"
              placeholder={selectedType === 'percentage' ? '15' : '300'}
              error={errors.value?.message}
              {...register('value', { valueAsNumber: true })}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Minimum Order Spend (BDT ৳)"
              type="number"
              placeholder="e.g. 1500"
              error={errors.minSpendBDT?.message}
              {...register('minSpendBDT', { valueAsNumber: true })}
            />

            <Input
              label="Max Redemption Count"
              type="number"
              placeholder="e.g. 100"
              error={errors.usageLimit?.message}
              {...register('usageLimit', { valueAsNumber: true })}
            />
          </div>
        </form>
      </Modal>
    </div>
  );
}
