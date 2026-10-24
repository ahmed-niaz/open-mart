'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  UploadCloud,
  X,
  Star,
  Plus,
  Link as LinkIcon,
  CheckCircle2,
  FileText,
  DollarSign,
  Package,
  Layers,
  Image as ImageIcon,
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
import { useProducts } from '@/hooks/admin/use-products';
import { useCategories } from '@/hooks/admin/use-categories';

const createProductSchema = z.object({
  title: z.string().min(2, 'Title must be at least 2 characters').max(255),
  sku: z
    .string()
    .min(3, 'SKU must be at least 3 characters')
    .regex(
      /^[A-Za-z0-9-]+$/,
      'SKU must contain only letters, numbers, and hyphens',
    ),
  unitPrice: z.number().positive('Price must be greater than 0'),
  compareAtPrice: z.number().optional().nullable(),
  categoryId: z.string().optional(),
  description: z.string().optional(),
  inventoryQuantity: z.number().int().min(0, 'Inventory cannot be negative'),
  trackQuantity: z.boolean(),
  isPublished: z.boolean(),
  tags: z.string().optional(),
});

type CreateProductFormData = z.infer<typeof createProductSchema>;

interface SelectedImageItem {
  id: string;
  file?: File;
  url: string;
  name: string;
  size?: number;
  isPrimary: boolean;
}

export default function NewProductPage() {
  const router = useRouter();
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const { createProduct, isCreating } = useProducts();
  const { categories, isLoading: isLoadingCategories } = useCategories();

  // Multi-image state
  const [selectedImages, setSelectedImages] = React.useState<
    SelectedImageItem[]
  >([]);
  const [urlInput, setUrlInput] = React.useState('');
  const [showUrlField, setShowUrlField] = React.useState(false);
  const [isDragging, setIsDragging] = React.useState(false);

  const {
    register,
    handleSubmit,
    setValue,
    control,
    formState: { errors },
  } = useForm<CreateProductFormData>({
    resolver: zodResolver(createProductSchema),
    defaultValues: {
      title: '',
      sku: '',
      unitPrice: undefined,
      compareAtPrice: undefined,
      categoryId: '',
      description: '',
      inventoryQuantity: 10,
      trackQuantity: true,
      isPublished: true,
      tags: '',
    },
  });

  const isPublishedWatch = useWatch({ control, name: 'isPublished' });

  // Handle files selected via file input or drag-and-drop (single or multiple)
  const handleFiles = (files: FileList | File[]) => {
    const fileArray = Array.from(files);
    if (fileArray.length === 0) return;

    const newItems: SelectedImageItem[] = fileArray.map((file, idx) => {
      const previewUrl = URL.createObjectURL(file);
      return {
        id: `${Date.now()}-${idx}-${Math.random().toString(36).substring(2, 9)}`,
        file,
        url: previewUrl,
        name: file.name,
        size: file.size,
        isPrimary: selectedImages.length === 0 && idx === 0,
      };
    });

    setSelectedImages((prev) => [...prev, ...newItems]);
    toast.success(`Added ${newItems.length} image(s)`);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFiles(e.dataTransfer.files);
    }
  };

  const handleRemoveImage = (id: string) => {
    setSelectedImages((prev) => {
      const filtered = prev.filter((img) => img.id !== id);
      // If the removed image was primary, make the first remaining image primary
      if (filtered.length > 0 && !filtered.some((img) => img.isPrimary)) {
        filtered[0].isPrimary = true;
      }
      return filtered;
    });
  };

  const handleSetPrimary = (id: string) => {
    setSelectedImages((prev) =>
      prev.map((img) => ({
        ...img,
        isPrimary: img.id === id,
      })),
    );
  };

  const handleAddUrl = () => {
    if (!urlInput.trim()) return;
    try {
      new URL(urlInput.trim());
      const newItem: SelectedImageItem = {
        id: `url-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
        url: urlInput.trim(),
        name: urlInput.trim().split('/').pop() || 'Remote Image',
        isPrimary: selectedImages.length === 0,
      };
      setSelectedImages((prev) => [...prev, newItem]);
      setUrlInput('');
      setShowUrlField(false);
      toast.success('Image URL attached');
    } catch {
      toast.error('Please enter a valid image URL');
    }
  };

  const onSubmit = async (data: CreateProductFormData) => {
    try {
      const formData = new FormData();
      formData.append('title', data.title.trim());
      formData.append('sku', data.sku.trim().toUpperCase());
      formData.append('unitPrice', String(data.unitPrice));
      formData.append('currency', 'BDT');
      formData.append('description', data.description || '');
      formData.append('inventoryQuantity', String(data.inventoryQuantity ?? 0));
      formData.append('trackQuantity', String(data.trackQuantity));
      formData.append('status', data.isPublished ? 'active' : 'draft');

      if (data.categoryId && data.categoryId.trim() !== '') {
        formData.append('categoryId', data.categoryId.trim());
      }

      if (data.compareAtPrice && data.compareAtPrice > 0) {
        formData.append('compareAtPrice', String(data.compareAtPrice));
      }

      if (data.tags && data.tags.trim() !== '') {
        const tagList = data.tags
          .split(',')
          .map((t) => t.trim())
          .filter(Boolean);
        formData.append('tags', JSON.stringify(tagList));
      }

      // Append raw files for upload to R2
      // Put the primary image first in line so it gets index 0
      const sortedImages = [...selectedImages].sort((a, b) =>
        a.isPrimary ? -1 : b.isPrimary ? 1 : 0,
      );

      sortedImages.forEach((img) => {
        if (img.file) {
          formData.append('files', img.file);
        }
      });

      // Also append URL-based images in the media array
      const urlMedia = sortedImages
        .filter((img) => !img.file && img.url)
        .map((img) => ({
          url: img.url,
          altText: data.title,
          isThumbnail: img.isPrimary,
        }));

      if (urlMedia.length > 0) {
        formData.append('media', JSON.stringify(urlMedia));
      }

      await createProduct(formData);
      router.push('/admin/products');
    } catch {
      // Error handled by api-client / useProducts toast
    }
  };

  return (
    <div className="space-y-6 pb-16">
      {/* Page Header */}
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
          <h1 className="text-2xl font-bold tracking-tight text-[#252A25]">
            Create New Product
          </h1>
          <p className="text-sm text-[#6B756D]">
            Add product details, upload multiple gallery photos, and configure
            pricing.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button
            type="button"
            variant="outline"
            fullWidth={false}
            onClick={() => router.push('/admin/products')}
            disabled={isCreating}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            form="create-product-form"
            variant="primary"
            fullWidth={false}
            loading={isCreating}
            leftIcon={<Plus className="h-4 w-4" />}
          >
            {isPublishedWatch ? 'Publish Product' : 'Save as Draft'}
          </Button>
        </div>
      </div>

      <form
        id="create-product-form"
        onSubmit={handleSubmit(onSubmit)}
        className="grid grid-cols-1 gap-6 lg:grid-cols-3"
      >
        {/* Left Column (2 cols): Main Product Info & Media */}
        <div className="space-y-6 lg:col-span-2">
          {/* Card 1: Basic Information */}
          <Card className="border-[#E5E0D5] shadow-xs">
            <CardHeader className="pb-4">
              <div className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-[#163A2B]" />
                <CardTitle className="text-base font-semibold text-[#252A25]">
                  General Information
                </CardTitle>
              </div>
              <CardDescription>
                Provide the core catalog attributes for your product.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Input
                label="Product Title *"
                placeholder="e.g. Organic Herbal Tea Blend (100g)"
                error={errors.title?.message}
                {...register('title')}
              />

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Input
                  label="SKU (Stock Keeping Unit) *"
                  placeholder="e.g. TEA-HRB-001"
                  helperText="Unique uppercase identifier for warehouse tracking"
                  error={errors.sku?.message}
                  {...register('sku', {
                    onChange: (e) => {
                      e.target.value = e.target.value.toUpperCase();
                    },
                  })}
                />

                <Select
                  label="Category"
                  disabled={isLoadingCategories}
                  error={errors.categoryId?.message}
                  {...register('categoryId')}
                  options={[
                    {
                      label: 'Select category (or leave uncategorized)',
                      value: '',
                    },
                    ...categories.map((c) => ({ label: c.name, value: c.id })),
                  ]}
                />
              </div>

              <Textarea
                label="Product Description"
                placeholder="Detailed description of features, materials, care instructions, origin..."
                rows={5}
                error={errors.description?.message}
                {...register('description')}
              />
            </CardContent>
          </Card>

          {/* Card 2: Multi-Image Media Gallery */}
          <Card className="border-[#E5E0D5] shadow-xs">
            <CardHeader className="pb-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ImageIcon className="h-5 w-5 text-[#163A2B]" />
                  <CardTitle className="text-base font-semibold text-[#252A25]">
                    Product Images & Media
                  </CardTitle>
                </div>
                <span className="rounded-full bg-[#FAF7F0] px-2.5 py-0.5 text-xs font-semibold text-[#163A2B] border border-[#E5E0D5]">
                  {selectedImages.length}{' '}
                  {selectedImages.length === 1 ? 'image' : 'images'}
                </span>
              </div>
              <CardDescription>
                Upload single or multiple images at once (PNG, JPG, WebP). Drag
                and drop or browse files.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Dropzone */}
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDragging(true);
                }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`flex flex-col items-center justify-center rounded-xl border-2 border-dashed p-8 text-center transition-all cursor-pointer ${
                  isDragging
                    ? 'border-[#163A2B] bg-[#163A2B]/5 scale-[0.99]'
                    : 'border-[#E5E0D5] bg-[#FAF7F0]/60 hover:border-[#163A2B]/50 hover:bg-[#FAF7F0]'
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept="image/png,image/jpeg,image/webp,image/avif,image/gif"
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files) {
                      handleFiles(e.target.files);
                      e.target.value = ''; // Reset input to allow re-uploading same file if desired
                    }
                  }}
                />

                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#FAF7F0] border border-[#E5E0D5] text-[#163A2B] mb-3 shadow-xs">
                  <UploadCloud className="h-6 w-6" />
                </div>
                <p className="text-sm font-semibold text-[#252A25]">
                  Click to upload or drag & drop multiple images
                </p>
                <p className="mt-1 text-xs text-[#6B756D]">
                  Select 1 or many images at once (PNG, JPG, WebP up to 10MB
                  each)
                </p>
                <div className="mt-3 inline-flex items-center gap-1.5 rounded-md border border-[#E5E0D5] bg-white px-3 py-1 text-xs font-medium text-[#252A25] shadow-2xs">
                  <Plus className="h-3.5 w-3.5 text-[#163A2B]" />
                  Choose Files
                </div>
              </div>

              {/* Add by URL Option */}
              <div className="pt-1">
                {!showUrlField ? (
                  <button
                    type="button"
                    onClick={() => setShowUrlField(true)}
                    className="inline-flex items-center gap-1.5 text-xs font-medium text-[#163A2B] hover:underline"
                  >
                    <LinkIcon className="h-3 w-3" />
                    Or attach image via URL
                  </button>
                ) : (
                  <div className="flex items-center gap-2 rounded-lg border border-[#E5E0D5] bg-[#FAF7F0] p-2">
                    <Input
                      placeholder="Paste image URL (https://...)"
                      value={urlInput}
                      onChange={(e) => setUrlInput(e.target.value)}
                      className="bg-white"
                    />
                    <Button
                      type="button"
                      variant="primary"
                      size="sm"
                      fullWidth={false}
                      onClick={handleAddUrl}
                    >
                      Attach
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      fullWidth={false}
                      onClick={() => {
                        setShowUrlField(false);
                        setUrlInput('');
                      }}
                    >
                      Cancel
                    </Button>
                  </div>
                )}
              </div>

              {/* Image Previews Grid */}
              {selectedImages.length > 0 && (
                <div className="space-y-2 pt-2">
                  <p className="text-xs font-semibold text-[#252A25] flex items-center gap-1.5">
                    <CheckCircle2 className="h-3.5 w-3.5 text-[#267A46]" />
                    Attached Images ({selectedImages.length}) — Click star to
                    set Primary Thumbnail
                  </p>

                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
                    {selectedImages.map((img) => (
                      <div
                        key={img.id}
                        className={`group relative flex flex-col overflow-hidden rounded-lg border bg-white p-2 transition-all ${
                          img.isPrimary
                            ? 'border-[#163A2B] ring-2 ring-[#163A2B]/20 shadow-xs'
                            : 'border-[#E5E0D5] hover:border-[#6B756D]'
                        }`}
                      >
                        <div className="relative aspect-square w-full overflow-hidden rounded-md bg-[#FAF7F0]">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={img.url}
                            alt={img.name}
                            className="h-full w-full object-cover"
                          />

                          {/* Primary Badge */}
                          {img.isPrimary && (
                            <span className="absolute top-1.5 left-1.5 flex items-center gap-1 rounded bg-[#163A2B] px-1.5 py-0.5 text-[10px] font-bold text-white shadow-xs">
                              <Star className="h-3 w-3 fill-white" />
                              Primary
                            </span>
                          )}

                          {/* Remove button */}
                          <button
                            type="button"
                            onClick={() => handleRemoveImage(img.id)}
                            className="absolute top-1.5 right-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-black/60 text-white opacity-80 transition-opacity hover:opacity-100 hover:bg-[#C53030]"
                            title="Remove image"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </div>

                        <div className="mt-2 flex items-center justify-between gap-1">
                          <p
                            className="truncate text-[11px] font-medium text-[#252A25]"
                            title={img.name}
                          >
                            {img.name}
                          </p>
                          {!img.isPrimary && (
                            <button
                              type="button"
                              onClick={() => handleSetPrimary(img.id)}
                              className="text-[10px] text-[#6B756D] hover:text-[#163A2B] font-semibold shrink-0"
                              title="Set as primary"
                            >
                              Make primary
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right Column (1 col): Pricing, Inventory & Status */}
        <div className="space-y-6">
          {/* Card 3: Pricing */}
          <Card className="border-[#E5E0D5] shadow-xs">
            <CardHeader className="pb-4">
              <div className="flex items-center gap-2">
                <DollarSign className="h-5 w-5 text-[#163A2B]" />
                <CardTitle className="text-base font-semibold text-[#252A25]">
                  Pricing & Currency
                </CardTitle>
              </div>
              <CardDescription>
                Base customer price and comparison anchor in BDT (৳).
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Input
                label="Retail Price (BDT ৳) *"
                type="number"
                step="0.01"
                placeholder="e.g. 1250"
                error={errors.unitPrice?.message}
                {...register('unitPrice', { valueAsNumber: true })}
              />

              <Input
                label="Compare-at Price (BDT ৳)"
                type="number"
                step="0.01"
                placeholder="e.g. 1500 (shows strike-through discount)"
                helperText="Optional original price to display savings to customers"
                error={errors.compareAtPrice?.message}
                {...register('compareAtPrice', {
                  setValueAs: (v) =>
                    v === '' || Number.isNaN(Number(v)) ? null : Number(v),
                })}
              />
            </CardContent>
          </Card>

          {/* Card 4: Inventory & Fulfillment */}
          <Card className="border-[#E5E0D5] shadow-xs">
            <CardHeader className="pb-4">
              <div className="flex items-center gap-2">
                <Package className="h-5 w-5 text-[#163A2B]" />
                <CardTitle className="text-base font-semibold text-[#252A25]">
                  Inventory & Stock
                </CardTitle>
              </div>
              <CardDescription>
                Initial stock count and quantity tracking.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Input
                label="Available Stock Quantity *"
                type="number"
                step="1"
                placeholder="e.g. 50"
                error={errors.inventoryQuantity?.message}
                {...register('inventoryQuantity', { valueAsNumber: true })}
              />

              <div className="flex items-center justify-between rounded-lg border border-[#E5E0D5] bg-[#FAF7F0] p-3">
                <div>
                  <p className="text-xs font-semibold text-[#252A25]">
                    Track Stock Quantity
                  </p>
                  <p className="text-[11px] text-[#6B756D]">
                    Auto-decrement inventory on orders
                  </p>
                </div>
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-[#E5E0D5] accent-[#163A2B] cursor-pointer"
                  {...register('trackQuantity')}
                />
              </div>
            </CardContent>
          </Card>

          {/* Card 5: Status & Visibility */}
          <Card className="border-[#E5E0D5] shadow-xs">
            <CardHeader className="pb-4">
              <div className="flex items-center gap-2">
                <Layers className="h-5 w-5 text-[#163A2B]" />
                <CardTitle className="text-base font-semibold text-[#252A25]">
                  Visibility & Tags
                </CardTitle>
              </div>
              <CardDescription>
                Control store publish state and search tags.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <label className="text-xs font-semibold text-[#252A25]">
                  Catalog Status
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setValue('isPublished', true)}
                    className={`flex flex-col items-center justify-center rounded-lg border p-3 text-center transition-all ${
                      isPublishedWatch
                        ? 'border-[#163A2B] bg-[#163A2B]/10 font-bold text-[#163A2B]'
                        : 'border-[#E5E0D5] bg-white text-[#6B756D] hover:bg-[#FAF7F0]'
                    }`}
                  >
                    <span className="text-xs">Published</span>
                    <span className="text-[10px] text-[#267A46]">
                      Active on Web
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setValue('isPublished', false)}
                    className={`flex flex-col items-center justify-center rounded-lg border p-3 text-center transition-all ${
                      !isPublishedWatch
                        ? 'border-[#B7791F] bg-[#B7791F]/10 font-bold text-[#B7791F]'
                        : 'border-[#E5E0D5] bg-white text-[#6B756D] hover:bg-[#FAF7F0]'
                    }`}
                  >
                    <span className="text-xs">Draft</span>
                    <span className="text-[10px] text-[#6B756D]">
                      Hidden from Web
                    </span>
                  </button>
                </div>
              </div>

              <Input
                label="Tags"
                placeholder="cotton, casual, summer, handcrafted"
                helperText="Comma-separated keywords for customer search"
                {...register('tags')}
              />
            </CardContent>
          </Card>

          {/* Submission Card for Mobile / Quick Access */}
          <Card className="border-[#E5E0D5] bg-[#FAF7F0]">
            <CardContent className="pt-5 space-y-3">
              <Button
                type="submit"
                form="create-product-form"
                variant="primary"
                fullWidth
                size="lg"
                loading={isCreating}
                leftIcon={<Plus className="h-5 w-5" />}
              >
                {isPublishedWatch ? 'Publish Product Now' : 'Save as Draft'}
              </Button>
              <Button
                type="button"
                variant="outline"
                fullWidth
                onClick={() => router.push('/admin/products')}
                disabled={isCreating}
              >
                Cancel & Return
              </Button>
            </CardContent>
          </Card>
        </div>
      </form>
    </div>
  );
}
