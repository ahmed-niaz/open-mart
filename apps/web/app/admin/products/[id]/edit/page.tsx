'use client';

import * as React from 'react';
import { useRouter, useParams } from 'next/navigation';
import {
  ArrowLeft,
  UploadCloud,
  FileText,
  DollarSign,
  Package,
  Layers,
  Image as ImageIcon,
  Save,
  Trash2,
} from 'lucide-react';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { useProduct, useProducts } from '@/hooks/admin/use-products';
import { useCategories } from '@/hooks/admin/use-categories';

const editProductSchema = z.object({
  title: z.string().min(2, 'Title must be at least 2 characters').max(255),
  unitPrice: z.number().positive('Price must be greater than 0'),
  categoryId: z.string().optional(),
  description: z.string().optional(),
  inventoryQuantity: z.number().int().min(0),
  isPublished: z.boolean(),
});

type EditProductFormData = z.infer<typeof editProductSchema>;

interface SelectedImageItem {
  id: string;
  file?: File;
  url: string;
  name: string;
  isPrimary: boolean;
}

function EditProductForm({
  product,
  categories,
  isCategoriesLoading,
}: {
  product: NonNullable<ReturnType<typeof useProduct>['data']>;
  categories: ReturnType<typeof useCategories>['categories'];
  isCategoriesLoading: boolean;
}) {
  const router = useRouter();
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const { updateProduct, isUpdating, deleteProduct, isDeleting } =
    useProducts();

  const [selectedImages, setSelectedImages] = React.useState<
    SelectedImageItem[]
  >(() => {
    if (product.media && product.media.length > 0) {
      return product.media.map((m, idx) => ({
        id: m.id || String(idx),
        url: m.url,
        name: m.url.split('/').pop() || `Image ${idx + 1}`,
        isPrimary: m.isPrimary ?? idx === 0,
      }));
    }
    return [];
  });

  const {
    register,
    handleSubmit,
    setValue,
    control,
    formState: { errors },
  } = useForm<EditProductFormData>({
    resolver: zodResolver(editProductSchema),
    defaultValues: {
      title: product.title,
      unitPrice: product.priceCents / 100,
      categoryId: product.categoryId || '',
      description: product.description || '',
      inventoryQuantity: product.availableStock ?? 0,
      isPublished: product.isPublished,
    },
  });

  const isPublishedWatch = useWatch({ control, name: 'isPublished' });

  const handleFiles = (files: FileList | File[]) => {
    const fileArray = Array.from(files);
    if (fileArray.length === 0) return;

    const newItems: SelectedImageItem[] = fileArray.map((file, idx) => ({
      id: `${Date.now()}-${idx}-${Math.random().toString(36).substring(2, 9)}`,
      file,
      url: URL.createObjectURL(file),
      name: file.name,
      isPrimary: selectedImages.length === 0 && idx === 0,
    }));

    setSelectedImages((prev) => [...prev, ...newItems]);
    toast.success(`Attached ${newItems.length} new image(s)`);
  };

  const onSubmit = async (data: EditProductFormData) => {
    try {
      await updateProduct({
        id: product.id,
        version: product.version, // Enforce Optimistic Concurrency Control
        title: data.title,
        description: data.description,
        priceBDT: data.unitPrice,
        categoryId: data.categoryId || undefined,
        isPublished: data.isPublished,
        inventoryQuantity: data.inventoryQuantity,
      });

      toast.success('Product updated successfully');
      router.push('/admin/products');
    } catch {
      // Handled by toast
    }
  };

  const handleDelete = async () => {
    if (
      confirm(`Are you sure you want to delete product "${product.title}"?`)
    ) {
      await deleteProduct(product.id);
      router.push('/admin/products');
    }
  };

  return (
    <div className="space-y-6 pb-16">
      {/* Header */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <button
            type="button"
            onClick={() => router.push('/admin/products')}
            className="group mb-2 inline-flex items-center gap-2 text-xs font-medium text-[#6B756D] hover:text-[#163A2B] transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5 transition-transform group-hover:-translate-x-0.5" />
            Back to Products
          </button>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight text-[#252A25]">
              Edit: {product.title}
            </h1>
            <span className="rounded-md border border-[#E5E0D5] bg-[#FAF7F0] px-2.5 py-0.5 text-xs font-mono text-[#6B756D]">
              OCC v{product.version}
            </span>
          </div>
          <p className="text-sm text-[#6B756D]">SKU: {product.sku}</p>
        </div>

        <div className="flex items-center gap-3">
          <Button
            type="button"
            variant="outline"
            fullWidth={false}
            onClick={handleDelete}
            disabled={isDeleting || isUpdating}
            className="text-[#C53030] hover:bg-[#C53030]/10 hover:border-[#C53030]"
            leftIcon={<Trash2 className="h-4 w-4" />}
          >
            Delete
          </Button>
          <Button
            type="submit"
            form="edit-product-form"
            variant="primary"
            fullWidth={false}
            loading={isUpdating}
            leftIcon={<Save className="h-4 w-4" />}
          >
            Save Changes
          </Button>
        </div>
      </div>

      <form
        id="edit-product-form"
        onSubmit={handleSubmit(onSubmit)}
        className="grid grid-cols-1 gap-6 lg:grid-cols-3"
      >
        <div className="space-y-6 lg:col-span-2">
          {/* General Information */}
          <Card className="border-[#E5E0D5] shadow-xs">
            <CardHeader className="pb-4">
              <div className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-[#163A2B]" />
                <CardTitle className="text-base font-semibold text-[#252A25]">
                  General Information
                </CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <Input
                label="Product Title *"
                error={errors.title?.message}
                {...register('title')}
              />

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Input
                  label="SKU Identifier"
                  value={product.sku}
                  disabled
                  helperText="SKU cannot be changed after creation"
                />

                <Select
                  label="Category"
                  disabled={isCategoriesLoading}
                  error={errors.categoryId?.message}
                  {...register('categoryId')}
                  options={[
                    { label: 'Uncategorized', value: '' },
                    ...categories.map((c) => ({ label: c.name, value: c.id })),
                  ]}
                />
              </div>

              <Textarea
                label="Product Description"
                rows={5}
                error={errors.description?.message}
                {...register('description')}
              />
            </CardContent>
          </Card>

          {/* Media Section */}
          <Card className="border-[#E5E0D5] shadow-xs">
            <CardHeader className="pb-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ImageIcon className="h-5 w-5 text-[#163A2B]" />
                  <CardTitle className="text-base font-semibold text-[#252A25]">
                    Gallery Images ({selectedImages.length})
                  </CardTitle>
                </div>
              </div>
              <CardDescription>Existing images and uploads.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div
                onClick={() => fileInputRef.current?.click()}
                className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-[#E5E0D5] bg-[#FAF7F0]/60 p-6 text-center cursor-pointer hover:border-[#163A2B]/50 hover:bg-[#FAF7F0] transition-colors"
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files) {
                      handleFiles(e.target.files);
                      e.target.value = '';
                    }
                  }}
                />
                <UploadCloud className="h-6 w-6 text-[#163A2B] mb-2" />
                <p className="text-sm font-semibold text-[#252A25]">
                  Click to add more images
                </p>
                <p className="text-xs text-[#6B756D]">
                  Select 1 or multiple files
                </p>
              </div>

              {selectedImages.length > 0 && (
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {selectedImages.map((img) => (
                    <div
                      key={img.id}
                      className="relative aspect-square rounded-lg border border-[#E5E0D5] bg-white overflow-hidden p-1"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={img.url}
                        alt={img.name}
                        className="h-full w-full object-cover rounded"
                      />
                      {img.isPrimary && (
                        <span className="absolute top-2 left-2 rounded bg-[#163A2B] px-1.5 py-0.5 text-[9px] font-bold text-white shadow-xs">
                          Primary
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right Column */}
        <div className="space-y-6">
          <Card className="border-[#E5E0D5] shadow-xs">
            <CardHeader className="pb-4">
              <div className="flex items-center gap-2">
                <DollarSign className="h-5 w-5 text-[#163A2B]" />
                <CardTitle className="text-base font-semibold text-[#252A25]">
                  Pricing
                </CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <Input
                label="Retail Price (BDT ৳) *"
                type="number"
                step="0.01"
                error={errors.unitPrice?.message}
                {...register('unitPrice', { valueAsNumber: true })}
              />
            </CardContent>
          </Card>

          <Card className="border-[#E5E0D5] shadow-xs">
            <CardHeader className="pb-4">
              <div className="flex items-center gap-2">
                <Package className="h-5 w-5 text-[#163A2B]" />
                <CardTitle className="text-base font-semibold text-[#252A25]">
                  Inventory
                </CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <Input
                label="Stock Quantity *"
                type="number"
                step="1"
                error={errors.inventoryQuantity?.message}
                {...register('inventoryQuantity', { valueAsNumber: true })}
              />
            </CardContent>
          </Card>

          <Card className="border-[#E5E0D5] shadow-xs">
            <CardHeader className="pb-4">
              <div className="flex items-center gap-2">
                <Layers className="h-5 w-5 text-[#163A2B]" />
                <CardTitle className="text-base font-semibold text-[#252A25]">
                  Catalog Status
                </CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setValue('isPublished', true)}
                  className={`flex flex-col items-center justify-center rounded-lg border p-3 text-center transition-all ${
                    isPublishedWatch
                      ? 'border-[#163A2B] bg-[#163A2B]/10 font-bold text-[#163A2B]'
                      : 'border-[#E5E0D5] bg-white text-[#6B756D]'
                  }`}
                >
                  <span className="text-xs">Published</span>
                </button>

                <button
                  type="button"
                  onClick={() => setValue('isPublished', false)}
                  className={`flex flex-col items-center justify-center rounded-lg border p-3 text-center transition-all ${
                    !isPublishedWatch
                      ? 'border-[#B7791F] bg-[#B7791F]/10 font-bold text-[#B7791F]'
                      : 'border-[#E5E0D5] bg-white text-[#6B756D]'
                  }`}
                >
                  <span className="text-xs">Draft</span>
                </button>
              </div>

              <Button
                type="submit"
                form="edit-product-form"
                variant="primary"
                fullWidth
                loading={isUpdating}
                leftIcon={<Save className="h-4 w-4" />}
              >
                Save Changes
              </Button>
            </CardContent>
          </Card>
        </div>
      </form>
    </div>
  );
}

export default function EditProductPage() {
  const router = useRouter();
  const params = useParams();
  const productId = params?.id as string;
  const { data: product, isLoading: isLoadingProduct } = useProduct(productId);
  const { categories, isLoading: isLoadingCategories } = useCategories();

  if (isLoadingProduct) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-64" />
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <Skeleton className="h-96 lg:col-span-2" />
          <Skeleton className="h-96" />
        </div>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="py-12 text-center">
        <p className="text-sm text-[#C53030]">Product not found.</p>
        <Button
          variant="outline"
          className="mt-4"
          onClick={() => router.push('/admin/products')}
        >
          Return to Products
        </Button>
      </div>
    );
  }

  return (
    <EditProductForm
      key={product.id}
      product={product}
      categories={categories}
      isCategoriesLoading={isLoadingCategories}
    />
  );
}
