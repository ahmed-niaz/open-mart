'use client';

import * as React from 'react';
import {
  UploadCloud,
  Search,
  Image as ImageIcon,
  HardDrive,
  Trash2,
  Copy,
  Edit3,
  ChevronLeft,
  ChevronRight,
  Database,
  Check,
  X,
  FileCheck,
  Eye,
} from 'lucide-react';
import { toast } from 'sonner';
import { AdminPageHeader } from '@/components/admin/layout/admin-page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Modal } from '@/components/ui/modal';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import {
  useMediaList,
  useMediaSummary,
  useUploadMedia,
  useUpdateMediaMetadata,
  useDeleteMediaAsset,
  useBulkDeleteMedia,
  type MediaAsset,
} from '@/hooks/admin/use-media';

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

function formatDisplayName(name?: string, maxLength = 36): string {
  if (!name) return '';
  if (name.length <= maxLength) return name;
  const extIndex = name.lastIndexOf('.');
  if (extIndex > 0 && name.length - extIndex <= 8) {
    const ext = name.slice(extIndex);
    const base = name.slice(0, extIndex);
    const keep = Math.max(8, maxLength - ext.length - 3);
    return `${base.slice(0, keep)}...${ext}`;
  }
  return `${name.slice(0, maxLength - 3)}...`;
}

export default function MediaLibraryPage() {
  const [page, setPage] = React.useState(1);
  const [search, setSearch] = React.useState('');
  const [selectedIds, setSelectedIds] = React.useState<Set<string>>(new Set());

  // Modals state
  const [isUploadModalOpen, setIsUploadModalOpen] = React.useState(false);
  const [editingAsset, setEditingAsset] = React.useState<MediaAsset | null>(
    null,
  );
  const [editAltText, setEditAltText] = React.useState('');
  const [editOriginalName, setEditOriginalName] = React.useState('');
  const [previewAsset, setPreviewAsset] = React.useState<MediaAsset | null>(
    null,
  );

  // Delete state
  const [deletingAsset, setDeletingAsset] = React.useState<MediaAsset | null>(
    null,
  );
  const [isBulkDeleteConfirmOpen, setIsBulkDeleteConfirmOpen] =
    React.useState(false);

  // Upload modal drop files
  const [pendingUploads, setPendingUploads] = React.useState<File[]>([]);
  const uploadFileInputRef = React.useRef<HTMLInputElement>(null);

  // Queries & Mutations
  const { data: summary, isLoading: isLoadingSummary } = useMediaSummary();
  const { data: mediaData, isLoading: isLoadingMedia } = useMediaList({
    page,
    limit: 24,
    search,
    mimeType: 'image/',
  });

  const uploadMutation = useUploadMedia();
  const updateMutation = useUpdateMediaMetadata();
  const deleteMutation = useDeleteMediaAsset();
  const bulkDeleteMutation = useBulkDeleteMedia();

  const handleCopyUrl = (url: string) => {
    navigator.clipboard.writeText(url);
    toast.success('Asset URL copied to clipboard');
  };

  const handleOpenEdit = (asset: MediaAsset) => {
    setEditingAsset(asset);
    setEditAltText(asset.altText || '');
    setEditOriginalName(asset.originalName || '');
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingAsset) return;

    await updateMutation.mutateAsync({
      id: editingAsset.id,
      altText: editAltText.trim(),
      originalName: editOriginalName.trim(),
    });
    setEditingAsset(null);
  };

  const handleDeleteConfirm = async () => {
    if (!deletingAsset) return;
    await deleteMutation.mutateAsync({
      id: deletingAsset.id,
      force: deletingAsset.usageCount > 0,
    });
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.delete(deletingAsset.id);
      return next;
    });
    setDeletingAsset(null);
  };

  const handleBulkDeleteConfirm = async () => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    await bulkDeleteMutation.mutateAsync({
      ids,
      force: true,
    });
    setSelectedIds(new Set());
    setIsBulkDeleteConfirmOpen(false);
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = (checked: boolean) => {
    if (checked && mediaData?.items) {
      setSelectedIds(new Set(mediaData.items.map((item) => item.id)));
    } else {
      setSelectedIds(new Set());
    }
  };

  const handleExecuteUpload = async () => {
    if (pendingUploads.length === 0) return;
    try {
      await uploadMutation.mutateAsync({
        files: pendingUploads,
        folder: 'products',
      });
      setPendingUploads([]);
      setIsUploadModalOpen(false);
    } catch {
      // Error handled by mutation toast
    }
  };

  const totalPages = mediaData?.totalPages || 1;
  const safePage = totalPages > 0 ? Math.min(page, totalPages) : page;

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <AdminPageHeader
        title="Centralized Media Library"
        subtitle="Manage product images and assets. Sourced via direct upload or shared database library."
        breadcrumbs={[{ label: 'Catalog' }, { label: 'Media Library' }]}
        actions={
          <Button
            type="button"
            variant="primary"
            size="sm"
            onClick={() => setIsUploadModalOpen(true)}
            className="gap-2"
          >
            <UploadCloud className="h-4 w-4" />
            Upload New Images
          </Button>
        }
      />

      {/* 4 KPI Summary Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Card 1: Total Assets */}
        <Card className="border-[#E5E0D5] bg-white shadow-xs">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-[#6B756D]">
              Total Files
            </CardTitle>
            <Database className="h-4 w-4 text-[#163A2B]" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-[#252A25]">
              {isLoadingSummary ? '...' : (summary?.totalFiles ?? 0)}
            </div>
            <p className="mt-1 text-xs text-[#6B756D]">
              Cataloged in PostgreSQL
            </p>
          </CardContent>
        </Card>

        {/* Card 2: Total Storage Size */}
        <Card className="border-[#E5E0D5] bg-white shadow-xs">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-[#6B756D]">
              Cloudflare Storage
            </CardTitle>
            <HardDrive className="h-4 w-4 text-[#163A2B]" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-[#163A2B]">
              {isLoadingSummary
                ? '...'
                : (summary?.totalSizeFormatted ?? '0 B')}
            </div>
            <p className="mt-1 text-xs text-[#6B756D]">
              Total physical footprint
            </p>
          </CardContent>
        </Card>

        {/* Card 3: Image Files */}
        <Card className="border-[#E5E0D5] bg-white shadow-xs">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-[#6B756D]">
              Image Assets
            </CardTitle>
            <ImageIcon className="h-4 w-4 text-[#267A46]" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-[#267A46]">
              {isLoadingSummary ? '...' : (summary?.imageFiles ?? 0)}
            </div>
            <p className="mt-1 text-xs text-[#6B756D]">
              PNG, JPG, WEBP formats
            </p>
          </CardContent>
        </Card>

        {/* Card 4: Unused Files */}
        <Card className="border-[#E5E0D5] bg-white shadow-xs">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-[#6B756D]">
              Unlinked Assets
            </CardTitle>
            <FileCheck className="h-4 w-4 text-[#B7791F]" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-[#B7791F]">
              {isLoadingSummary ? '...' : (summary?.unusedFiles ?? 0)}
            </div>
            <p className="mt-1 text-xs text-[#6B756D]">
              0 product associations
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Area */}
      <Card className="border-[#E5E0D5] bg-white shadow-xs">
        {/* Toolbar & Filters */}
        <div className="p-4 border-b border-[#E5E0D5]/70 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-3 w-full sm:w-auto">
            <div className="relative w-full sm:w-80">
              <Input
                type="text"
                placeholder="Search assets by file name or alt text..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                leftIcon={<Search className="h-4 w-4" />}
                className="h-9 text-xs bg-white rounded-full border-[#E5E0D5]"
              />
            </div>
          </div>

          <div className="flex items-center gap-2">
            {selectedIds.size > 0 && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsBulkDeleteConfirmOpen(true)}
                className="border-red-200 text-red-600 hover:bg-red-50 hover:border-red-300 gap-1.5"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Delete Selected ({selectedIds.size})
              </Button>
            )}

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsUploadModalOpen(true)}
              className="gap-1.5"
            >
              <UploadCloud className="h-3.5 w-3.5" />
              Upload
            </Button>
          </div>
        </div>

        {/* Selection Bar */}
        {mediaData?.items && mediaData.items.length > 0 && (
          <div className="px-5 py-2.5 bg-neutral-50 border-b border-[#E5E0D5]/70 flex items-center justify-between text-xs text-[#6B756D]">
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={
                  mediaData.items.length > 0 &&
                  selectedIds.size === mediaData.items.length
                }
                onChange={(e) => toggleSelectAll(e.target.checked)}
                className="h-3.5 w-3.5 rounded border-[#E5E0D5] text-[#163A2B] focus:ring-[#163A2B] cursor-pointer"
              />
              <span className="font-semibold text-[#252A25]">
                Select All on Page
              </span>
            </label>

            <span>
              Showing {mediaData.items.length} of {mediaData.total} assets
            </span>
          </div>
        )}

        {/* Media Assets Grid */}
        <CardContent className="p-5">
          {isLoadingMedia ? (
            <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-4">
              {Array.from({ length: 18 }).map((_, i) => (
                <div
                  key={i}
                  className="aspect-square rounded-xl bg-neutral-100 animate-pulse border border-[#E5E0D5]"
                />
              ))}
            </div>
          ) : mediaData?.items && mediaData.items.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
              {mediaData.items.map((asset) => {
                const isSelected = selectedIds.has(asset.id);

                return (
                  <div
                    key={asset.id}
                    className={`group relative rounded-xl border bg-white overflow-hidden transition-all flex flex-col ${
                      isSelected
                        ? 'border-[#163A2B] ring-2 ring-[#163A2B] shadow-sm'
                        : 'border-[#E5E0D5] hover:border-[#163A2B]/60 hover:shadow-xs'
                    }`}
                  >
                    {/* Image Thumbnail Container */}
                    <div
                      onClick={() => toggleSelect(asset.id)}
                      className="relative aspect-square w-full bg-neutral-50 overflow-hidden cursor-pointer"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={asset.url}
                        alt={asset.altText || asset.originalName}
                        className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                        loading="lazy"
                      />

                      {/* Selection Checkbox */}
                      <div
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleSelect(asset.id);
                        }}
                        className={`absolute top-2 left-2 flex h-5 w-5 items-center justify-center rounded-full border transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-[#163A2B] border-[#163A2B] text-white shadow-xs'
                            : 'bg-white/90 border-[#E5E0D5] text-transparent hover:border-[#163A2B]'
                        }`}
                      >
                        <Check className="h-3 w-3 stroke-[3]" />
                      </div>

                      {/* Usage Badge */}
                      <div className="absolute top-2 right-2">
                        {asset.usageCount > 0 ? (
                          <span className="rounded-full bg-emerald-950/80 backdrop-blur-xs px-2 py-0.5 text-[9px] font-semibold text-emerald-200">
                            {asset.usageCount} product
                            {asset.usageCount > 1 ? 's' : ''}
                          </span>
                        ) : (
                          <span className="rounded-full bg-black/60 backdrop-blur-xs px-2 py-0.5 text-[9px] font-semibold text-white">
                            Unlinked
                          </span>
                        )}
                      </div>

                      {/* Hover Overlay with Quick Actions */}
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1.5 p-2">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setPreviewAsset(asset);
                          }}
                          className="h-8 w-8 rounded-full bg-white/90 text-[#252A25] hover:bg-white hover:text-[#163A2B] flex items-center justify-center transition-colors cursor-pointer shadow-xs"
                          title="Preview Image"
                        >
                          <Eye className="h-3.5 w-3.5" />
                        </button>

                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleCopyUrl(asset.url);
                          }}
                          className="h-8 w-8 rounded-full bg-white/90 text-[#252A25] hover:bg-white hover:text-[#163A2B] flex items-center justify-center transition-colors cursor-pointer shadow-xs"
                          title="Copy Public URL"
                        >
                          <Copy className="h-3.5 w-3.5" />
                        </button>

                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOpenEdit(asset);
                          }}
                          className="h-8 w-8 rounded-full bg-white/90 text-[#252A25] hover:bg-white hover:text-[#163A2B] flex items-center justify-center transition-colors cursor-pointer shadow-xs"
                          title="Edit Metadata"
                        >
                          <Edit3 className="h-3.5 w-3.5" />
                        </button>

                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setDeletingAsset(asset);
                          }}
                          className="h-8 w-8 rounded-full bg-white/90 text-red-600 hover:bg-red-600 hover:text-white flex items-center justify-center transition-colors cursor-pointer shadow-xs"
                          title="Permanent Delete"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Metadata Footer */}
                    <div className="p-2.5 text-xs bg-white border-t border-[#E5E0D5]/50">
                      <p
                        className="font-medium text-[#252A25] truncate"
                        title={asset.originalName}
                      >
                        {asset.originalName}
                      </p>
                      <div className="flex items-center justify-between text-[11px] text-[#6B756D] mt-1">
                        <span>{formatBytes(asset.fileSizeBytes)}</span>
                        <span className="uppercase text-[9px] font-semibold">
                          {asset.mimeType.split('/')[1] || 'IMG'}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[#163A2B]/10 text-[#163A2B] mb-3">
                <ImageIcon className="h-7 w-7" />
              </div>
              <h3 className="text-sm font-bold text-[#252A25]">
                No media assets found
              </h3>
              <p className="mt-1 text-xs text-[#6B756D] max-w-sm">
                Upload images from your computer to store them in your
                centralized Media Library.
              </p>
              <Button
                type="button"
                variant="primary"
                size="sm"
                onClick={() => setIsUploadModalOpen(true)}
                className="mt-4 gap-2"
              >
                <UploadCloud className="h-4 w-4" />
                Upload Images Now
              </Button>
            </div>
          )}

          {/* Pagination */}
          {mediaData && mediaData.totalPages > 1 && (
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pt-6 mt-6 border-t border-[#E5E0D5]/70 text-xs text-[#6B756D]">
              <span>
                Page <strong>{safePage}</strong> of{' '}
                <strong>{mediaData.totalPages}</strong> ({mediaData.total}{' '}
                items)
              </span>

              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={safePage <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className="gap-1"
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                  Previous
                </Button>

                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={safePage >= mediaData.totalPages}
                  onClick={() =>
                    setPage((p) => Math.min(mediaData.totalPages, p + 1))
                  }
                  className="gap-1"
                >
                  Next
                  <ChevronRight className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Upload Modal */}
      <Modal
        isOpen={isUploadModalOpen}
        onClose={() => setIsUploadModalOpen(false)}
        title="Upload Assets to Media Library"
        description="Uploaded images are permanently stored in Cloudflare R2 and can be attached to any product."
        maxWidth="lg"
        footer={
          <div className="flex w-full items-center justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsUploadModalOpen(false)}
              disabled={uploadMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="primary"
              size="sm"
              loading={uploadMutation.isPending}
              disabled={pendingUploads.length === 0}
              onClick={handleExecuteUpload}
            >
              Upload{' '}
              {pendingUploads.length > 0 ? `(${pendingUploads.length})` : ''}{' '}
              Files
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          <input
            type="file"
            ref={uploadFileInputRef}
            multiple
            accept="image/png,image/jpeg,image/webp,image/gif"
            className="hidden"
            onChange={(e) => {
              if (e.target.files) {
                const arr = Array.from(e.target.files).filter((f) =>
                  f.type.startsWith('image/'),
                );
                setPendingUploads((prev) => [...prev, ...arr]);
                e.target.value = '';
              }
            }}
          />

          <div
            onClick={() => uploadFileInputRef.current?.click()}
            className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-[#E5E0D5] p-8 text-center hover:bg-neutral-50 hover:border-[#163A2B]/60 transition-all cursor-pointer"
          >
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#163A2B]/10 text-[#163A2B] mb-3">
              <UploadCloud className="h-6 w-6" />
            </div>
            <p className="text-sm font-semibold text-[#252A25]">
              Click to select files from your computer
            </p>
            <p className="mt-1 text-xs text-[#6B756D]">
              PNG, JPG, WEBP, or GIF up to 10MB per file
            </p>
          </div>

          {pendingUploads.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-[#252A25]">
                  Files queued for upload ({pendingUploads.length})
                </span>
                <button
                  type="button"
                  onClick={() => setPendingUploads([])}
                  className="text-red-600 hover:underline cursor-pointer"
                >
                  Clear Queue
                </button>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 max-h-[200px] overflow-y-auto p-1">
                {pendingUploads.map((file, idx) => {
                  const url = URL.createObjectURL(file);
                  return (
                    <div
                      key={idx}
                      className="group relative aspect-square rounded-xl border border-[#E5E0D5] p-1 bg-white overflow-hidden shadow-2xs"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={url}
                        alt={file.name}
                        className="h-full w-full object-cover rounded-lg"
                      />
                      <button
                        type="button"
                        onClick={() =>
                          setPendingUploads((prev) =>
                            prev.filter((_, i) => i !== idx),
                          )
                        }
                        className="absolute top-1.5 right-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-red-600 text-white shadow-xs hover:bg-red-700 cursor-pointer"
                      >
                        <X className="h-3 w-3" />
                      </button>
                      <div className="absolute inset-x-0 bottom-0 bg-black/75 p-1 text-[9px] text-white truncate">
                        {file.name}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </Modal>

      {/* Edit Metadata Modal */}
      <Modal
        isOpen={Boolean(editingAsset)}
        onClose={() => setEditingAsset(null)}
        title="Edit Media Asset"
        description="Update file label or accessibility alt text for catalog use."
        maxWidth="md"
        footer={
          <div className="flex w-full items-center justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setEditingAsset(null)}
              disabled={updateMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              form="edit-media-form"
              variant="primary"
              size="sm"
              loading={updateMutation.isPending}
            >
              Save Changes
            </Button>
          </div>
        }
      >
        {editingAsset && (
          <form
            id="edit-media-form"
            onSubmit={handleSaveEdit}
            className="space-y-4"
          >
            <div className="flex items-center gap-3 p-3 rounded-xl border border-[#E5E0D5] bg-neutral-50">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={editingAsset.url}
                alt={editingAsset.altText || editingAsset.originalName}
                className="h-16 w-16 object-cover rounded-lg border border-[#E5E0D5]"
              />
              <div className="text-xs space-y-0.5 min-w-0 flex-1 overflow-hidden">
                <p
                  className="font-semibold text-[#252A25] truncate"
                  title={editingAsset.fileName}
                >
                  {editingAsset.fileName}
                </p>
                <p className="text-[#6B756D]">
                  {formatBytes(editingAsset.fileSizeBytes)}
                </p>
                <p className="text-[#163A2B] font-medium">
                  {editingAsset.usageCount} active product link
                  {editingAsset.usageCount !== 1 ? 's' : ''}
                </p>
              </div>
            </div>

            <Input
              label="Original File Name"
              value={editOriginalName}
              onChange={(e) => setEditOriginalName(e.target.value)}
              placeholder="e.g. Minimalist Ceramic Cup Front.png"
            />

            <Input
              label="Accessibility Alt Text (SEO)"
              value={editAltText}
              onChange={(e) => setEditAltText(e.target.value)}
              placeholder="e.g. Matte beige handcrafted ceramic mug on wooden surface"
              helperText="Screen readers and search engines use this description."
            />
          </form>
        )}
      </Modal>

      {/* Preview Fullscreen Modal */}
      <Modal
        isOpen={Boolean(previewAsset)}
        onClose={() => setPreviewAsset(null)}
        title={
          previewAsset
            ? formatDisplayName(
                previewAsset.originalName ||
                  previewAsset.fileName ||
                  'Asset Preview',
                38,
              )
            : 'Asset Preview'
        }
        maxWidth="2xl"
        contentClassName="p-4 sm:p-5"
        bodyClassName="p-0 py-1"
        footer={
          <div className="flex w-full items-center justify-between">
            <span className="text-xs text-[#6B756D]">
              {previewAsset ? formatBytes(previewAsset.fileSizeBytes) : ''}
            </span>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => previewAsset && handleCopyUrl(previewAsset.url)}
                className="gap-1.5 rounded-full"
              >
                <Copy className="h-3.5 w-3.5" />
                Copy URL
              </Button>
              <Button
                type="button"
                variant="primary"
                size="sm"
                onClick={() => setPreviewAsset(null)}
                className="rounded-full"
              >
                Close
              </Button>
            </div>
          </div>
        }
      >
        {previewAsset && (
          <div className="w-full flex items-center justify-center p-0 rounded-xl overflow-hidden bg-neutral-900/5">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={previewAsset.url}
              alt={previewAsset.altText || previewAsset.originalName}
              className="max-h-[72vh] w-auto max-w-full rounded-lg object-contain shadow-xs"
            />
          </div>
        )}
      </Modal>

      {/* Single Delete Confirm Dialog */}
      <ConfirmDialog
        isOpen={Boolean(deletingAsset)}
        onClose={() => setDeletingAsset(null)}
        onConfirm={handleDeleteConfirm}
        title="Permanently Delete Media Asset?"
        description={
          deletingAsset && deletingAsset.usageCount > 0
            ? `WARNING: "${deletingAsset.originalName}" is currently referenced by ${deletingAsset.usageCount} product(s). Permanently deleting this file will cause image display issues on those products. Are you sure you want to proceed?`
            : `Are you sure you want to permanently delete "${deletingAsset?.originalName}" from your Media Library and Cloudflare R2 storage? This action cannot be undone.`
        }
        confirmLabel="Delete Permanently"
        variant="destructive"
        loading={deleteMutation.isPending}
      />

      {/* Bulk Delete Confirm Dialog */}
      <ConfirmDialog
        isOpen={isBulkDeleteConfirmOpen}
        onClose={() => setIsBulkDeleteConfirmOpen(false)}
        onConfirm={handleBulkDeleteConfirm}
        title={`Permanently Delete ${selectedIds.size} Media Assets?`}
        description={`This will permanently remove the selected ${selectedIds.size} file(s) from your database and purge them from Cloudflare R2 storage. Any products currently linking to these assets will lose their image references.`}
        confirmLabel={`Delete ${selectedIds.size} Files Permanently`}
        variant="destructive"
        loading={bulkDeleteMutation.isPending}
      />
    </div>
  );
}
