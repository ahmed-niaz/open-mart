'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { apiClient } from '@/lib/api-client';

export interface MediaAsset {
  id: string;
  fileName: string;
  originalName: string;
  mimeType: string;
  fileSizeBytes: number;
  url: string;
  storageKey: string;
  altText: string;
  width?: number;
  height?: number;
  uploadedBy?: string;
  usageCount: number;
  isArchived: boolean;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface MediaSummary {
  totalFiles: number;
  totalSizeBytes: number;
  totalSizeFormatted: string;
  imageFiles: number;
  unusedFiles: number;
}

export interface PaginatedMediaResult {
  items: MediaAsset[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface UseMediaListParams {
  page?: number;
  limit?: number;
  search?: string;
  mimeType?: string;
  isArchived?: boolean;
  sortBy?: 'created_at' | 'file_size' | 'original_name';
  sortOrder?: 'asc' | 'desc';
}

export function useMediaList(params: UseMediaListParams = {}) {
  const {
    page = 1,
    limit = 24,
    search,
    mimeType,
    isArchived = false,
    sortBy = 'created_at',
    sortOrder = 'desc',
  } = params;

  return useQuery<PaginatedMediaResult>({
    queryKey: [
      'admin-media-list',
      page,
      limit,
      search,
      mimeType,
      isArchived,
      sortBy,
      sortOrder,
    ],
    queryFn: async () => {
      const res = await apiClient<PaginatedMediaResult>('/api/admin/media', {
        params: {
          page,
          limit,
          search: search?.trim() || undefined,
          mimeType: mimeType && mimeType !== 'all' ? mimeType : undefined,
          isArchived,
          sortBy,
          sortOrder,
        },
      });
      return {
        items: res?.items || [],
        total: res?.total || 0,
        page: res?.page || page,
        limit: res?.limit || limit,
        totalPages: res?.totalPages || 1,
      };
    },
  });
}

export function useMediaSummary() {
  return useQuery<MediaSummary>({
    queryKey: ['admin-media-summary'],
    queryFn: async () => {
      return apiClient<MediaSummary>('/api/admin/media/summary');
    },
  });
}

export function useUploadMedia() {
  const queryClient = useQueryClient();

  return useMutation<MediaAsset[], Error, { files: File[]; folder?: string }>({
    mutationFn: async ({ files, folder = 'media-library' }) => {
      const formData = new FormData();
      formData.append('folder', folder);
      files.forEach((file) => {
        formData.append('files', file);
      });

      return apiClient<MediaAsset[]>('/api/admin/media/upload', {
        method: 'POST',
        body: formData,
      });
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['admin-media-list'] });
      queryClient.invalidateQueries({ queryKey: ['admin-media-summary'] });
      toast.success(
        `Successfully uploaded ${data.length} file${data.length > 1 ? 's' : ''}`,
      );
    },
    onError: (err) => {
      toast.error(err.message || 'Failed to upload media files');
    },
  });
}

export function useUpdateMediaMetadata() {
  const queryClient = useQueryClient();

  return useMutation<
    MediaAsset,
    Error,
    { id: string; altText?: string; originalName?: string }
  >({
    mutationFn: async ({ id, altText, originalName }) => {
      return apiClient<MediaAsset>(`/api/admin/media/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ altText, originalName }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-media-list'] });
      toast.success('Media details updated successfully');
    },
    onError: (err) => {
      toast.error(err.message || 'Failed to update media details');
    },
  });
}

export function useDeleteMediaAsset() {
  const queryClient = useQueryClient();

  return useMutation<void, Error, { id: string; force?: boolean }>({
    mutationFn: async ({ id, force = false }) => {
      await apiClient(`/api/admin/media/${id}`, {
        method: 'DELETE',
        params: { force: force ? 'true' : 'false' },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-media-list'] });
      queryClient.invalidateQueries({ queryKey: ['admin-media-summary'] });
      toast.success('Asset permanently deleted from library and storage');
    },
    onError: (err) => {
      toast.error(err.message || 'Failed to delete media asset');
    },
  });
}

export function useBulkDeleteMedia() {
  const queryClient = useQueryClient();

  return useMutation<
    { deletedCount: number },
    Error,
    { ids: string[]; force?: boolean }
  >({
    mutationFn: async ({ ids, force = false }) => {
      return apiClient<{ deletedCount: number }>(
        '/api/admin/media/bulk-delete',
        {
          method: 'POST',
          body: JSON.stringify({ ids, force }),
        },
      );
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['admin-media-list'] });
      queryClient.invalidateQueries({ queryKey: ['admin-media-summary'] });
      toast.success(`Deleted ${data.deletedCount} asset(s) permanently`);
    },
    onError: (err) => {
      toast.error(err.message || 'Failed to perform bulk delete');
    },
  });
}
