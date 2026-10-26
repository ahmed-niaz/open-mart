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
  Info,
  Plus,
  X,
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
import {
  useProduct,
  useProducts,
  type AdminProductVariant,
} from '@/hooks/admin/use-products';
import { useCategories } from '@/hooks/admin/use-categories';
import { ProductVariantsManager } from '@/components/admin/products/product-variants-manager';
import {
  MediaPickerModal,
  type SelectedMediaItem,
} from '@/components/admin/media/media-picker-modal';

const editProductSchema = z.object({
  title: z.string().min(2, 'Title must be at least 2 characters').max(255),
  unitPrice: z.number().positive('Price must be greater than 0'),
  categoryId: z.string().optional(),
  description: z.string().optional(),
  inventoryQuantity: z.number().int().min(0),
  status: z.enum(['active', 'draft', 'archived']),
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

  const [isMediaPickerOpen, setIsMediaPickerOpen] = React.useState(false);
  const [variants, setVariants] = React.useState<AdminProductVariant[]>(
    () => product.variants || [],
  );

  const handleMediaPickerSelect = (items: SelectedMediaItem[]) => {
    setSelectedImages((prev) => {
      const existingUrls = new Set(prev.map((img) => img.url));
      const freshItems = items.filter((item) => !existingUrls.has(item.url));

      if (freshItems.length === 0) {
        toast.info('Selected image(s) are already attached to this product.');
        return prev;
      }

      const newItems: SelectedImageItem[] = freshItems.map((item, idx) => ({
        id:
          item.id ||
          `media-${Date.now()}-${idx}-${Math.random().toString(36).substring(2, 7)}`,
        url: item.url,
        name: item.originalName || item.url.split('/').pop() || 'media-asset',
        isPrimary: prev.length === 0 && idx === 0,
      }));

      toast.success(`Attached ${newItems.length} image(s) from Media Library`);
      return [...prev, ...newItems];
    });
    setIsMediaPickerOpen(false);
  };

  const handleRemoveImage = (id: string) => {
    setSelectedImages((prev) => {
      const filtered = prev.filter((img) => img.id !== id);
      if (filtered.length > 0 && !filtered.some((img) => img.isPrimary)) {
        filtered[0].isPrimary = true;
      }
      return filtered;
    });
    toast.info(
      'Image detached from product. Asset remains safe in your Media Library.',
    );
  };

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
      status:
        (product.status as 'active' | 'draft' | 'archived') ||
        (product.isPublished ? 'active' : 'draft'),
    },
  });

  const watchStatus = useWatch({ control, name: 'status' });
  const watchUnitPrice = useWatch({ control, name: 'unitPrice' });
  const watchInventory = useWatch({ control, name: 'inventoryQuantity' });

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
        status: data.status,
        isPublished: data.status === 'active',
        inventoryQuantity: data.inventoryQuantity,
        variants: variants.map((v) => ({
          id: v.id,
          name: v.name,
          type: v.type,
          color: v.color,
          options: v.options,
          sku: v.sku ? v.sku.trim().toUpperCase() : undefined,
          priceBDT:
            v.priceBDT !== undefined && !isNaN(v.priceBDT)
              ? v.priceBDT
              : data.unitPrice,
          inventoryQuantity: v.inventoryQuantity ?? 0,
          imageUrl: v.imageUrl,
        })),
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
                  Add more images
                </p>
                <p className="text-xs text-[#6B756D] mt-0.5 mb-3">
                  Upload from your PC or choose from your Media Library
                </p>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      fileInputRef.current?.click();
                    }}
                    className="inline-flex items-center gap-1.5 rounded-full border border-[#E5E0D5] bg-white px-3 py-1.5 text-xs font-semibold text-[#252A25] shadow-2xs hover:bg-neutral-50 transition-colors cursor-pointer"
                  >
                    <Plus className="h-3.5 w-3.5 text-[#163A2B]" />
                    Upload from PC
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setIsMediaPickerOpen(true);
                    }}
                    className="inline-flex items-center gap-1.5 rounded-full border border-[#163A2B] bg-[#163A2B] px-3.5 py-1.5 text-xs font-semibold text-white shadow-2xs hover:bg-[#214D3A] transition-colors cursor-pointer"
                  >
                    <ImageIcon className="h-3.5 w-3.5 text-white" />
                    Select from Media Library
                  </button>
                </div>
              </div>

              {/* Safe Detach Disclaimer Banner */}
              <div className="flex items-start gap-2.5 rounded-xl border border-blue-200 bg-blue-50/60 p-3 text-xs text-blue-900">
                <Info className="h-4 w-4 text-blue-600 shrink-0 mt-0.5" />
                <p className="leading-relaxed">
                  <strong>Media Safe-Detach:</strong> Removing an image detaches
                  it from this product only. The original asset remains safely
                  preserved in your Centralized Media Library.
                </p>
              </div>

              {selectedImages.length > 0 && (
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {selectedImages.map((img) => (
                    <div
                      key={img.id}
                      className="relative aspect-square rounded-lg border border-[#E5E0D5] bg-white overflow-hidden p-1 group"
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
                      <button
                        type="button"
                        onClick={() => handleRemoveImage(img.id)}
                        className="absolute top-2 right-2 flex h-6 w-6 items-center justify-center rounded-full bg-black/60 text-white opacity-0 group-hover:opacity-100 hover:bg-[#C53030] transition-all cursor-pointer"
                        title="Detach image from product"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Card: Product Variants */}
          <ProductVariantsManager
            variants={variants}
            onChange={setVariants}
            baseSku={product.sku}
            basePrice={watchUnitPrice}
            baseStock={watchInventory}
          />
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

          {/* Card: Catalog Status */}
          <Card className="border-[#E5E0D5] bg-white shadow-xs">
            <CardHeader className="pb-3 border-b border-[#E5E0D5]/60">
              <div className="flex items-center gap-2">
                <Layers className="h-5 w-5 text-[#163A2B]" />
                <CardTitle className="text-base font-semibold text-[#252A25]">
                  Catalog Status
                </CardTitle>
              </div>
              <CardDescription className="text-xs text-[#6B756D]">
                Control storefront discovery and sales lifecycle.
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-4 space-y-2.5">
              {/* Published */}
              <button
                type="button"
                onClick={() => setValue('status', 'active')}
                className={`w-full flex items-start gap-3 p-3 rounded-xl border text-left transition-all cursor-pointer ${
                  watchStatus === 'active'
                    ? 'border-[#163A2B] bg-[#163A2B]/5 ring-1 ring-[#163A2B]'
                    : 'border-[#E5E0D5] bg-white hover:bg-neutral-50'
                }`}
              >
                <div
                  className={`mt-0.5 flex h-4 w-4 items-center justify-center rounded-full border ${
                    watchStatus === 'active'
                      ? 'border-[#163A2B] bg-[#163A2B]'
                      : 'border-[#E5E0D5] bg-white'
                  }`}
                >
                  {watchStatus === 'active' && (
                    <div className="h-1.5 w-1.5 rounded-full bg-white" />
                  )}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-[#252A25]">
                      Published
                    </span>
                    <span className="inline-flex items-center rounded-full bg-[#163A2B]/10 px-2 py-0.2 text-[10px] font-semibold text-[#163A2B]">
                      Active
                    </span>
                  </div>
                  <p className="mt-0.5 text-[11px] text-[#6B756D]">
                    Visible to customers in storefront and available for
                    purchase.
                  </p>
                </div>
              </button>

              {/* Draft */}
              <button
                type="button"
                onClick={() => setValue('status', 'draft')}
                className={`w-full flex items-start gap-3 p-3 rounded-xl border text-left transition-all cursor-pointer ${
                  watchStatus === 'draft'
                    ? 'border-[#B7791F] bg-[#B7791F]/5 ring-1 ring-[#B7791F]'
                    : 'border-[#E5E0D5] bg-white hover:bg-neutral-50'
                }`}
              >
                <div
                  className={`mt-0.5 flex h-4 w-4 items-center justify-center rounded-full border ${
                    watchStatus === 'draft'
                      ? 'border-[#B7791F] bg-[#B7791F]'
                      : 'border-[#E5E0D5] bg-white'
                  }`}
                >
                  {watchStatus === 'draft' && (
                    <div className="h-1.5 w-1.5 rounded-full bg-white" />
                  )}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-[#252A25]">
                      Draft
                    </span>
                    <span className="inline-flex items-center rounded-full bg-[#B7791F]/10 px-2 py-0.2 text-[10px] font-semibold text-[#B7791F]">
                      Hidden
                    </span>
                  </div>
                  <p className="mt-0.5 text-[11px] text-[#6B756D]">
                    Hidden from storefront while edits or inventory are
                    prepared.
                  </p>
                </div>
              </button>

              {/* Archived */}
              <button
                type="button"
                onClick={() => setValue('status', 'archived')}
                className={`w-full flex items-start gap-3 p-3 rounded-xl border text-left transition-all cursor-pointer ${
                  watchStatus === 'archived'
                    ? 'border-[#64748B] bg-[#64748B]/5 ring-1 ring-[#64748B]'
                    : 'border-[#E5E0D5] bg-white hover:bg-neutral-50'
                }`}
              >
                <div
                  className={`mt-0.5 flex h-4 w-4 items-center justify-center rounded-full border ${
                    watchStatus === 'archived'
                      ? 'border-[#64748B] bg-[#64748B]'
                      : 'border-[#E5E0D5] bg-white'
                  }`}
                >
                  {watchStatus === 'archived' && (
                    <div className="h-1.5 w-1.5 rounded-full bg-white" />
                  )}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-[#252A25]">
                      Archived
                    </span>
                    <span className="inline-flex items-center rounded-full bg-[#64748B]/10 px-2 py-0.2 text-[10px] font-semibold text-[#64748B]">
                      Retired
                    </span>
                  </div>
                  <p className="mt-0.5 text-[11px] text-[#6B756D]">
                    Retired from catalog. Preserves sales reporting and past
                    order links.
                  </p>
                </div>
              </button>

              <div className="pt-3 border-t border-[#E5E0D5]/70 space-y-2">
                <Button
                  type="submit"
                  form="edit-product-form"
                  variant="primary"
                  fullWidth
                  loading={isUpdating}
                  leftIcon={<Save className="h-4 w-4" />}
                  className="rounded-full"
                >
                  Save Changes
                </Button>

                <Button
                  type="button"
                  variant="outline"
                  fullWidth
                  onClick={() => router.push('/admin/products')}
                  className="rounded-full"
                >
                  Cancel & Return
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </form>

      {/* Centralized Media Picker Modal */}
      <MediaPickerModal
        isOpen={isMediaPickerOpen}
        onClose={() => setIsMediaPickerOpen(false)}
        onSelect={handleMediaPickerSelect}
        multiple={true}
        selectedUrls={selectedImages.map((img) => img.url)}
      />
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
