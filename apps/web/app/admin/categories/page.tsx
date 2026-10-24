'use client';

import * as React from 'react';
import { Plus, Layers } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

import { AdminPageHeader } from '@/components/admin/layout/admin-page-header';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { StatusBadge } from '@/components/ui/badge';
import { DataTable, type Column } from '@/components/ui/data-table';
import { Modal } from '@/components/ui/modal';
import { useCategories, type Category } from '@/hooks/admin/use-categories';

const categorySchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  description: z.string().optional(),
  isPublished: z.boolean(),
});

type CategoryFormData = z.infer<typeof categorySchema>;

export default function AdminCategoriesPage() {
  const [isModalOpen, setIsModalOpen] = React.useState(false);
  const { categories, isLoading, createCategory, isCreating } = useCategories();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CategoryFormData>({
    resolver: zodResolver(categorySchema),
    defaultValues: {
      name: '',
      description: '',
      isPublished: true,
    },
  });

  const onSubmit = async (data: CategoryFormData) => {
    await createCategory(data);
    reset();
    setIsModalOpen(false);
  };

  const columns: Column<Category>[] = [
    {
      header: 'Category Name',
      accessorKey: 'name',
      cell: (cat) => (
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#FAF7F0] border border-[#E5E0D5] text-[#163A2B]">
            <Layers className="h-4 w-4" />
          </div>
          <div>
            <p className="font-semibold text-xs text-[#252A25]">{cat.name}</p>
            <p className="text-[10px] font-mono text-[#6B756D]">/{cat.slug}</p>
          </div>
        </div>
      ),
    },
    {
      header: 'Description',
      accessorKey: 'description',
      cell: (cat) => (
        <span className="text-xs text-[#6B756D] max-w-sm truncate block">
          {cat.description || '-'}
        </span>
      ),
    },
    {
      header: 'Status',
      accessorKey: 'isPublished',
      cell: (cat) => (
        <StatusBadge status={cat.isPublished ? 'Published' : 'Draft'} />
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Category Tree & Taxonomies"
        subtitle="Organize product collections, navigation menus, and category groupings."
        breadcrumbs={[{ label: 'Catalog' }, { label: 'Categories' }]}
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
            Create Category
          </Button>
        }
      />

      <Card className="shadow-xs">
        <CardContent className="pt-5">
          <DataTable
            columns={columns}
            data={categories}
            isLoading={isLoading}
            emptyMessage="No categories created yet."
          />
        </CardContent>
      </Card>

      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Create Category"
        description="Add a new catalog department for product classification"
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
              form="category-form"
              variant="primary"
              fullWidth
              loading={isCreating}
            >
              Create Category
            </Button>
          </div>
        }
      >
        <form
          id="category-form"
          onSubmit={handleSubmit(onSubmit)}
          className="space-y-4 py-2"
        >
          <Input
            label="Category Name *"
            placeholder="e.g. Traditional Wear"
            error={errors.name?.message}
            {...register('name')}
          />

          <Textarea
            label="Description"
            placeholder="Category overview displayed on collection headers..."
            error={errors.description?.message}
            {...register('description')}
          />

          <div className="flex items-center justify-between rounded-lg border border-[#E5E0D5] bg-[#FAF7F0] p-3">
            <div>
              <p className="text-xs font-semibold text-[#252A25]">
                Published & Active
              </p>
              <p className="text-[11px] text-[#6B756D]">
                Visible in store navigation menus
              </p>
            </div>
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-[#E5E0D5] accent-[#163A2B] cursor-pointer"
              {...register('isPublished')}
            />
          </div>
        </form>
      </Modal>
    </div>
  );
}
