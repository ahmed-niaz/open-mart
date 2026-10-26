export interface MediaAssetDto {
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

export interface MediaSummaryDto {
  totalFiles: number;
  totalSizeBytes: number;
  totalSizeFormatted: string;
  imageFiles: number;
  unusedFiles: number;
}

export interface PaginatedMediaResultDto {
  items: MediaAssetDto[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}
