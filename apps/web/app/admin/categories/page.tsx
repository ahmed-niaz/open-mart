'use client';

import * as React from 'react';
import {
  Plus,
  Layers,
  Edit3,
  Trash2,
  Eye,
  EyeOff,
  Search,
  X,
  FolderTree,
  CheckCircle2,
  FileText,
} from 'lucide-react';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

import { AdminPageHeader } from '@/components/admin/layout/admin-page-header';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select } from '@/components/ui/select';
import { StatusBadge } from '@/components/ui/badge';
import { DataTable, type Column } from '@/components/ui/data-table';
import { DropdownMenu } from '@/components/ui/dropdown-menu';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Modal } from '@/components/ui/modal';
import { KpiCard } from '@/components/ui/kpi-card';
import { useCategories, type Category } from '@/hooks/admin/use-categories';
import { cn } from '@/lib/utils';

const categorySchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters').max(150),
  description: z.string().optional(),
  parentId: z.string().optional().nullable(),
  isPublished: z.boolean(),
});

type CategoryFormData = z.infer<typeof categorySchema>;

export default function AdminCategoriesPage() {
  const {
    categories,
    isLoading,
    createCategory,
    isCreating,
    updateCategory,
    isUpdating,
    deleteCategory,
    isDeleting,
    toggleCategoryStatus,
  } = useCategories();

  // Search input state
  const [searchInput, setSearchInput] = React.useState('');

  // Modal states
  const [isModalOpen, setIsModalOpen] = React.useState(false);
  const [editingCategory, setEditingCategory] = React.useState<Category | null>(
    null,
  );
  const [categoryToDelete, setCategoryToDelete] =
    React.useState<Category | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    control,
    setValue,
    formState: { errors },
  } = useForm<CategoryFormData>({
    resolver: zodResolver(categorySchema),
    defaultValues: {
      name: '',
      description: '',
      parentId: '',
      isPublished: true,
    },
  });

  const watchPublished = useWatch({
    control,
    name: 'isPublished',
    defaultValue: true,
  });

  const openCreateModal = () => {
    setEditingCategory(null);
    reset({
      name: '',
      description: '',
      parentId: '',
      isPublished: true,
    });
    setIsModalOpen(true);
  };

  const openEditModal = (cat: Category) => {
    setEditingCategory(cat);
    reset({
      name: cat.name,
      description: cat.description || '',
      parentId: cat.parentId || '',
      isPublished: cat.isPublished,
    });
    setIsModalOpen(true);
  };

  const onSubmit = async (data: CategoryFormData) => {
    if (editingCategory) {
      await updateCategory({
        id: editingCategory.id,
        name: data.name,
        description: data.description,
        parentId: data.parentId || null,
        isPublished: data.isPublished,
      });
    } else {
      await createCategory({
        name: data.name,
        description: data.description,
        parentId: data.parentId || null,
        isPublished: data.isPublished,
      });
    }
    reset();
    setIsModalOpen(false);
    setEditingCategory(null);
  };

  const handleDelete = async () => {
    if (!categoryToDelete) return;
    await deleteCategory(categoryToDelete.id);
    setCategoryToDelete(null);
  };

  // Filtered categories
  const filteredCategories = React.useMemo(() => {
    if (!searchInput.trim()) return categories;
    const q = searchInput.toLowerCase().trim();
    return categories.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.slug.toLowerCase().includes(q) ||
        (c.description && c.description.toLowerCase().includes(q)),
    );
  }, [categories, searchInput]);

  // KPI Metrics
  const metrics = React.useMemo(() => {
    const total = categories.length;
    const published = categories.filter((c) => c.isPublished).length;
    const drafts = total - published;
    const rootCategories = categories.filter((c) => !c.parentId).length;
    return { total, published, drafts, rootCategories };
  }, [categories]);

  // Available parent options (prevent selecting self to avoid cycles)
  const parentOptions = React.useMemo(() => {
    return categories.filter(
      (c) => !editingCategory || c.id !== editingCategory.id,
    );
  }, [categories, editingCategory]);

  const columns: Column<Category>[] = [
    {
      header: 'Category Name',
      accessorKey: 'name',
      cell: (cat) => (
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#FAF7F0] border border-[#E5E0D5] text-[#163A2B] shrink-0">
            <Layers className="h-4 w-4" />
          </div>
          <div className="min-w-0 max-w-xs">
            <p
              className="font-semibold text-xs text-[#252A25] truncate"
              title={cat.name}
            >
              {cat.name}
            </p>
            <p className="text-[10px] font-mono text-[#6B756D] truncate">
              /{cat.slug}
            </p>
          </div>
        </div>
      ),
    },
    {
      header: 'Hierarchy / Parent',
      accessorKey: 'parentId',
      cell: (cat) => (
        <span
          className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-medium ${
            cat.parentId
              ? 'border border-[#E5E0D5] bg-[#FAF7F0] text-[#163A2B]'
              : 'border border-[#267A46]/20 bg-[#267A46]/10 text-[#267A46]'
          }`}
        >
          <FolderTree className="h-3 w-3" />
          {cat.parentName || (cat.parentId ? 'Subcategory' : 'Root Department')}
        </span>
      ),
    },
    {
      header: 'Description',
      accessorKey: 'description',
      cell: (cat) => (
        <span
          className="text-xs text-[#6B756D] max-w-sm truncate block"
          title={cat.description || undefined}
        >
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
    {
      header: 'Actions',
      align: 'right',
      cell: (cat) => (
        <div
          className="flex items-center justify-end"
          onClick={(e) => e.stopPropagation()}
        >
          <DropdownMenu
            actions={[
              {
                label: 'Edit Details',
                icon: <Edit3 className="h-4 w-4" />,
                onClick: () => openEditModal(cat),
              },
              cat.isPublished
                ? {
                    label: 'Unpublish (Draft)',
                    icon: <EyeOff className="h-4 w-4" />,
                    onClick: () =>
                      toggleCategoryStatus({ id: cat.id, isPublished: false }),
                  }
                : {
                    label: 'Publish Category',
                    icon: <Eye className="h-4 w-4" />,
                    onClick: () =>
                      toggleCategoryStatus({ id: cat.id, isPublished: true }),
                  },
              {
                label: 'Delete Category',
                icon: <Trash2 className="h-4 w-4" />,
                variant: 'destructive',
                onClick: () => setCategoryToDelete(cat),
              },
            ]}
          />
        </div>
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
            onClick={openCreateModal}
            leftIcon={<Plus className="h-4 w-4" />}
            className="rounded-full"
          >
            Create Category
          </Button>
        }
      />

      {/* KPI Metrics */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          title="Total Categories"
          value={metrics.total}
          icon={Layers}
          subtitle="Taxonomy classifications"
        />
        <KpiCard
          title="Published & Active"
          value={metrics.published}
          icon={CheckCircle2}
          subtitle="Visible in store menus"
        />
        <KpiCard
          title="Draft / Inactive"
          value={metrics.drafts}
          icon={FileText}
          subtitle="Hidden from storefront"
        />
        <KpiCard
          title="Root Departments"
          value={metrics.rootCategories}
          icon={FolderTree}
          subtitle="Top-level navigation nodes"
        />
      </div>

      {/* Filter / Search Bar */}
      <Card className="border border-[#E5E0D5] bg-white shadow-xs">
        <CardContent className="p-3.5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#6B756D]" />
            <Input
              type="text"
              placeholder="Search categories by name, slug, or overview..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="pl-9 pr-8 h-9 text-xs"
            />
            {searchInput && (
              <button
                type="button"
                onClick={() => setSearchInput('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#6B756D] hover:text-[#252A25]"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          <span className="text-xs text-[#6B756D] font-medium">
            Showing {filteredCategories.length} of {categories.length}{' '}
            categories
          </span>
        </CardContent>
      </Card>

      {/* Categories Data Table (without redundant outer card border) */}
      <DataTable
        columns={columns}
        data={filteredCategories}
        isLoading={isLoading}
        emptyMessage={
          searchInput
            ? 'No categories match your search keyword.'
            : 'No categories created yet. Click "Create Category" to add your first classification.'
        }
      />

      {/* Create / Edit Category Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setEditingCategory(null);
        }}
        title={
          editingCategory
            ? `Edit Category: ${editingCategory.name}`
            : 'Create Category'
        }
        description={
          editingCategory
            ? 'Update classification name, hierarchy grouping, and storefront visibility.'
            : 'Add a new catalog department for product classification and navigation.'
        }
        maxWidth="lg"
        footer={
          <div className="flex w-full items-center justify-end gap-3 pt-1">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setIsModalOpen(false);
                setEditingCategory(null);
              }}
              disabled={isCreating || isUpdating}
              className="rounded-full px-5"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              form="category-form"
              variant="primary"
              loading={isCreating || isUpdating}
              className="rounded-full px-6"
            >
              {editingCategory ? 'Save Changes' : 'Create Category'}
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
            helperText={
              editingCategory
                ? `Storefront slug: /${editingCategory.slug}`
                : 'A clean URL slug is generated automatically from the name.'
            }
            {...register('name')}
          />

          <Select
            label="Parent Department (Hierarchy)"
            error={errors.parentId?.message}
            {...register('parentId')}
          >
            <option value="">Root Department (No Parent)</option>
            {parentOptions.map((cat) => (
              <option key={cat.id} value={cat.id}>
                {cat.name} (/{cat.slug})
              </option>
            ))}
          </Select>

          <Textarea
            label="Description"
            placeholder="Category overview displayed on collection headers and SEO snippets..."
            error={errors.description?.message}
            rows={3}
            className="resize-none"
            {...register('description')}
          />

          {/* Storefront Visibility & Catalog Status */}
          <div className="space-y-1.5 pt-1">
            <label className="text-xs font-semibold uppercase tracking-wider text-[#6B756D]">
              Storefront Status
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() =>
                  setValue('isPublished', true, { shouldDirty: true })
                }
                className={cn(
                  'flex items-start gap-3 p-3.5 rounded-xl border text-left transition-all cursor-pointer',
                  watchPublished
                    ? 'border-[#163A2B] bg-[#163A2B]/5 ring-1 ring-[#163A2B]'
                    : 'border-[#E5E0D5] bg-white hover:bg-neutral-50',
                )}
              >
                <div
                  className={cn(
                    'mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border transition-colors',
                    watchPublished
                      ? 'border-[#163A2B] bg-[#163A2B]'
                      : 'border-[#E5E0D5] bg-white',
                  )}
                >
                  {watchPublished && (
                    <div className="h-1.5 w-1.5 rounded-full bg-white" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-bold text-[#252A25]">
                      Published
                    </span>
                    <span className="inline-flex items-center rounded-full bg-[#163A2B]/10 px-2 py-0.5 text-[10px] font-semibold text-[#163A2B]">
                      Active
                    </span>
                  </div>
                  <p className="mt-0.5 text-[11px] text-[#6B756D] leading-tight">
                    Visible in customer storefront navigation and filters
                  </p>
                </div>
              </button>

              <button
                type="button"
                onClick={() =>
                  setValue('isPublished', false, { shouldDirty: true })
                }
                className={cn(
                  'flex items-start gap-3 p-3.5 rounded-xl border text-left transition-all cursor-pointer',
                  !watchPublished
                    ? 'border-[#163A2B] bg-[#163A2B]/5 ring-1 ring-[#163A2B]'
                    : 'border-[#E5E0D5] bg-white hover:bg-neutral-50',
                )}
              >
                <div
                  className={cn(
                    'mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border transition-colors',
                    !watchPublished
                      ? 'border-[#163A2B] bg-[#163A2B]'
                      : 'border-[#E5E0D5] bg-white',
                  )}
                >
                  {!watchPublished && (
                    <div className="h-1.5 w-1.5 rounded-full bg-white" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-bold text-[#252A25]">
                      Draft
                    </span>
                    <span className="inline-flex items-center rounded-full bg-neutral-200 px-2 py-0.5 text-[10px] font-semibold text-[#6B756D]">
                      Hidden
                    </span>
                  </div>
                  <p className="mt-0.5 text-[11px] text-[#6B756D] leading-tight">
                    Hidden from customer catalog until published
                  </p>
                </div>
              </button>
            </div>
          </div>
        </form>
      </Modal>

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        isOpen={Boolean(categoryToDelete)}
        onClose={() => setCategoryToDelete(null)}
        onConfirm={handleDelete}
        title="Delete Category"
        description={`Are you sure you want to permanently delete category "${categoryToDelete?.name}"? Any products assigned to this category will become uncategorized. This action cannot be undone.`}
        confirmLabel="Delete Category"
        variant="destructive"
        loading={isDeleting}
      />
    </div>
  );
}
