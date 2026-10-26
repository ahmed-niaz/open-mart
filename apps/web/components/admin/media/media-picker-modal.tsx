'use client';

import * as React from 'react';
import {
  UploadCloud,
  Check,
  Search,
  Image as ImageIcon,
  X,
  ChevronLeft,
  ChevronRight,
  HardDrive,
  Database,
} from 'lucide-react';
import { Modal } from '@/components/ui/modal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  useMediaList,
  useUploadMedia,
  type MediaAsset,
} from '@/hooks/admin/use-media';

export interface SelectedMediaItem {
  id?: string;
  url: string;
  altText?: string;
  originalName?: string;
}

interface MediaPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (items: SelectedMediaItem[]) => void;
  multiple?: boolean;
  selectedUrls?: string[];
}

export function MediaPickerModal({
  isOpen,
  onClose,
  onSelect,
  multiple = true,
  selectedUrls = [],
}: MediaPickerModalProps) {
  const [activeTab, setActiveTab] = React.useState<'library' | 'upload'>(
    'library',
  );

  // Search & Pagination for Media Library tab
  const [search, setSearch] = React.useState('');
  const [page, setPage] = React.useState(1);
  const [selectedItems, setSelectedItems] = React.useState<
    Map<string, SelectedMediaItem>
  >(new Map());

  // Local files for Upload tab
  const [pendingFiles, setPendingFiles] = React.useState<File[]>([]);
  const [isDragging, setIsDragging] = React.useState(false);

  const fileInputRef = React.useRef<HTMLInputElement>(null);

  // Queries & Mutations
  const { data: mediaData, isLoading } = useMediaList({
    page,
    limit: 18,
    search,
    mimeType: 'image/',
  });

  const uploadMutation = useUploadMedia();

  const handleClose = () => {
    setSelectedItems(new Map());
    setPendingFiles([]);
    setPage(1);
    setSearch('');
    onClose();
  };

  const toggleSelectAsset = (asset: MediaAsset) => {
    if (!multiple) {
      onSelect([
        {
          id: asset.id,
          url: asset.url,
          altText: asset.altText || asset.originalName,
          originalName: asset.originalName,
        },
      ]);
      handleClose();
      return;
    }

    setSelectedItems((prev) => {
      const next = new Map(prev);
      if (next.has(asset.url)) {
        next.delete(asset.url);
      } else {
        next.set(asset.url, {
          id: asset.id,
          url: asset.url,
          altText: asset.altText || asset.originalName,
          originalName: asset.originalName,
        });
      }
      return next;
    });
  };

  const handleSelectAllPage = () => {
    if (!mediaData?.items) return;
    setSelectedItems((prev) => {
      const next = new Map(prev);
      mediaData.items.forEach((asset) => {
        if (!selectedUrls.includes(asset.url)) {
          next.set(asset.url, {
            id: asset.id,
            url: asset.url,
            altText: asset.altText || asset.originalName,
            originalName: asset.originalName,
          });
        }
      });
      return next;
    });
  };

  const handleClearSelection = () => {
    setSelectedItems(new Map());
  };

  const handleFilesChosen = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const array = Array.from(files).filter((f) => f.type.startsWith('image/'));
    setPendingFiles((prev) => [...prev, ...array]);
  };

  const removePendingFile = (idx: number) => {
    setPendingFiles((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleUploadAndAttach = async () => {
    if (pendingFiles.length === 0) return;
    try {
      const uploaded = await uploadMutation.mutateAsync({
        files: pendingFiles,
        folder: 'products',
      });

      const selected = uploaded.map((asset) => ({
        id: asset.id,
        url: asset.url,
        altText: asset.altText || asset.originalName,
        originalName: asset.originalName,
      }));

      onSelect(selected);
      handleClose();
    } catch {
      // Error handled by mutation toast
    }
  };

  const handleConfirmSelection = () => {
    const items = Array.from(selectedItems.values());
    if (items.length > 0) {
      onSelect(items);
      handleClose();
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Select Product Images"
      description="Choose images from your Media Library or upload new assets directly from your computer."
      maxWidth="4xl"
      contentClassName="p-4 sm:p-5"
      bodyClassName="py-2"
      footer={
        <div className="flex w-full items-center justify-between gap-3">
          <div className="text-xs text-[#6B756D]">
            {activeTab === 'library' ? (
              <span>
                <strong>{selectedItems.size}</strong> image
                {selectedItems.size !== 1 ? 's' : ''} selected
              </span>
            ) : (
              <span>
                <strong>{pendingFiles.length}</strong> file
                {pendingFiles.length !== 1 ? 's' : ''} ready to upload
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleClose}
              disabled={uploadMutation.isPending}
            >
              Cancel
            </Button>

            {activeTab === 'library' ? (
              <Button
                type="button"
                variant="primary"
                size="sm"
                disabled={selectedItems.size === 0}
                onClick={handleConfirmSelection}
              >
                Attach {selectedItems.size > 0 ? selectedItems.size : ''} Image
                {selectedItems.size !== 1 ? 's' : ''} to Product
              </Button>
            ) : (
              <Button
                type="button"
                variant="primary"
                size="sm"
                loading={uploadMutation.isPending}
                disabled={pendingFiles.length === 0}
                onClick={handleUploadAndAttach}
              >
                Upload & Attach ({pendingFiles.length})
              </Button>
            )}
          </div>
        </div>
      }
    >
      <div className="space-y-4">
        {/* Navigation Tabs */}
        <div className="flex border-b border-[#E5E0D5]">
          <button
            type="button"
            onClick={() => setActiveTab('library')}
            className={`flex items-center gap-2 px-5 py-2.5 text-xs font-semibold border-b-2 transition-colors cursor-pointer ${
              activeTab === 'library'
                ? 'border-[#163A2B] text-[#163A2B] bg-[#163A2B]/5'
                : 'border-transparent text-[#6B756D] hover:text-[#252A25] hover:bg-neutral-50'
            }`}
          >
            <Database className="h-4 w-4" />
            Media Library (Stored in DB)
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('upload')}
            className={`flex items-center gap-2 px-5 py-2.5 text-xs font-semibold border-b-2 transition-colors cursor-pointer ${
              activeTab === 'upload'
                ? 'border-[#163A2B] text-[#163A2B] bg-[#163A2B]/5'
                : 'border-transparent text-[#6B756D] hover:text-[#252A25] hover:bg-neutral-50'
            }`}
          >
            <HardDrive className="h-4 w-4" />
            Upload from Computer (Local Storage)
          </button>
        </div>

        {/* Tab 1: Media Library */}
        {activeTab === 'library' && (
          <div className="space-y-4">
            {/* Search toolbar */}
            <div className="flex items-center justify-between gap-3">
              <div className="w-full sm:w-80">
                <Input
                  type="text"
                  placeholder="Search assets by name or alt text..."
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setPage(1);
                  }}
                  leftIcon={<Search className="h-3.5 w-3.5" />}
                  className="h-8 text-xs bg-white rounded-full border-[#E5E0D5]"
                />
              </div>

              <span className="text-xs text-[#6B756D] shrink-0">
                Total: <strong>{mediaData?.total || 0}</strong> assets
              </span>
            </div>

            {/* Multiple Selection Actions Toolbar */}
            {multiple && mediaData?.items && mediaData.items.length > 0 && (
              <div className="flex items-center justify-between px-3 py-1.5 rounded-lg border border-[#E5E0D5] bg-neutral-50/70 text-xs text-[#6B756D]">
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={handleSelectAllPage}
                    className="font-semibold text-[#163A2B] hover:underline cursor-pointer"
                  >
                    Select All on Page
                  </button>
                  {selectedItems.size > 0 && (
                    <button
                      type="button"
                      onClick={handleClearSelection}
                      className="text-[#DC2626] font-medium hover:underline cursor-pointer"
                    >
                      Clear Selection ({selectedItems.size})
                    </button>
                  )}
                </div>

                <span className="font-medium text-[#252A25]">
                  {selectedItems.size} image
                  {selectedItems.size !== 1 ? 's' : ''} selected
                </span>
              </div>
            )}

            {/* Asset Grid */}
            {isLoading ? (
              <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-3 py-6">
                {Array.from({ length: 12 }).map((_, i) => (
                  <div
                    key={i}
                    className="aspect-square rounded-xl bg-neutral-100 animate-pulse border border-[#E5E0D5]"
                  />
                ))}
              </div>
            ) : mediaData?.items && mediaData.items.length > 0 ? (
              <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-3 max-h-[380px] overflow-y-auto p-1">
                {mediaData.items.map((asset) => {
                  const isSelected = selectedItems.has(asset.url);
                  const isAlreadyAttached = selectedUrls.includes(asset.url);

                  return (
                    <div
                      key={asset.id}
                      onClick={() => toggleSelectAsset(asset)}
                      className={`group relative aspect-square rounded-xl border p-1 transition-all cursor-pointer overflow-hidden bg-white ${
                        isSelected
                          ? 'border-[#163A2B] ring-2 ring-[#163A2B] shadow-xs'
                          : 'border-[#E5E0D5] hover:border-[#163A2B]/60 hover:shadow-2xs'
                      }`}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={asset.url}
                        alt={asset.altText || asset.originalName}
                        className="h-full w-full object-cover rounded-lg"
                        loading="lazy"
                      />

                      {/* Selection Checkmark */}
                      <div
                        className={`absolute top-2 right-2 flex h-5 w-5 items-center justify-center rounded-full border transition-all ${
                          isSelected
                            ? 'bg-[#163A2B] border-[#163A2B] text-white'
                            : 'bg-white/90 border-[#E5E0D5] opacity-0 group-hover:opacity-100 text-transparent'
                        }`}
                      >
                        <Check className="h-3 w-3 stroke-[3]" />
                      </div>

                      {/* Already Attached Badge */}
                      {isAlreadyAttached && (
                        <span className="absolute bottom-1.5 left-1.5 rounded-full bg-black/75 px-1.5 py-0.5 text-[9px] font-semibold text-white">
                          In Product
                        </span>
                      )}

                      {/* Title overlay on hover */}
                      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                        <p className="text-[10px] text-white truncate font-medium">
                          {asset.originalName}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-12 text-center rounded-xl border border-dashed border-[#E5E0D5] bg-neutral-50/50">
                <ImageIcon className="h-10 w-10 text-[#6B756D]/40 mb-2" />
                <p className="text-xs font-semibold text-[#252A25]">
                  No images found
                </p>
                <p className="text-[11px] text-[#6B756D] mt-0.5">
                  Switch to the &ldquo;Upload from Computer&rdquo; tab to add
                  new assets.
                </p>
              </div>
            )}

            {/* Pagination */}
            {mediaData && mediaData.totalPages > 1 && (
              <div className="flex items-center justify-between pt-2 border-t border-[#E5E0D5]/70 text-xs text-[#6B756D]">
                <span>
                  Page {page} of {mediaData.totalPages}
                </span>

                <div className="flex items-center gap-1.5">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={page <= 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    className="h-7 px-2 text-xs"
                  >
                    <ChevronLeft className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={page >= mediaData.totalPages}
                    onClick={() =>
                      setPage((p) => Math.min(mediaData.totalPages, p + 1))
                    }
                    className="h-7 px-2 text-xs"
                  >
                    <ChevronRight className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Tab 2: Upload from Computer */}
        {activeTab === 'upload' && (
          <div className="space-y-4">
            <input
              type="file"
              ref={fileInputRef}
              multiple={multiple}
              accept="image/png,image/jpeg,image/webp,image/gif"
              className="hidden"
              onChange={(e) => {
                handleFilesChosen(e.target.files);
                e.target.value = '';
              }}
            />

            {/* Drag & Drop Zone */}
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={(e) => {
                e.preventDefault();
                setIsDragging(false);
                handleFilesChosen(e.dataTransfer.files);
              }}
              onClick={() => fileInputRef.current?.click()}
              className={`flex flex-col items-center justify-center rounded-2xl border-2 border-dashed p-8 text-center transition-all cursor-pointer ${
                isDragging
                  ? 'border-[#163A2B] bg-[#163A2B]/5'
                  : 'border-[#E5E0D5] bg-white hover:bg-neutral-50 hover:border-[#163A2B]/50'
              }`}
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#163A2B]/10 text-[#163A2B] mb-3">
                <UploadCloud className="h-6 w-6" />
              </div>
              <h4 className="text-sm font-semibold text-[#252A25]">
                Click to browse or drag and drop image files
              </h4>
              <p className="mt-1 text-xs text-[#6B756D]">
                PNG, JPG, WEBP or GIF (automatically cataloged into the Media
                Library)
              </p>
            </div>

            {/* Pending Files Preview List */}
            {pendingFiles.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-[#252A25]">
                    Files to Upload ({pendingFiles.length})
                  </span>
                  <button
                    type="button"
                    onClick={() => setPendingFiles([])}
                    className="text-red-600 hover:underline cursor-pointer"
                  >
                    Clear All
                  </button>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-3 max-h-[220px] overflow-y-auto p-1">
                  {pendingFiles.map((file, idx) => {
                    const previewUrl = URL.createObjectURL(file);
                    return (
                      <div
                        key={idx}
                        className="group relative aspect-square rounded-xl border border-[#E5E0D5] p-1 bg-white overflow-hidden shadow-2xs"
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={previewUrl}
                          alt={file.name}
                          className="h-full w-full object-cover rounded-lg"
                        />
                        <button
                          type="button"
                          onClick={() => removePendingFile(idx)}
                          className="absolute top-1.5 right-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-red-600 text-white shadow-xs hover:bg-red-700 transition-colors cursor-pointer"
                        >
                          <X className="h-3 w-3" />
                        </button>
                        <div className="absolute inset-x-0 bottom-0 bg-black/70 p-1 text-[9px] text-white truncate">
                          {file.name}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </Modal>
  );
}
