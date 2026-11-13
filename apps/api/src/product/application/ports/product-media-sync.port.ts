export interface RegisterUploadedMediaInput {
  buffer: Buffer;
  originalName: string;
  mimeType: string;
  size: number;
  folder?: string;
  uploadedBy?: string;
  altText?: string;
}

export interface RegisteredMediaResult {
  url: string;
  storageKey: string;
  fileName: string;
  altText: string;
}

export const PRODUCT_MEDIA_SYNC_PORT = Symbol('PRODUCT_MEDIA_SYNC_PORT');

export interface ProductMediaSyncPort {
  /**
   * Uploads files to storage AND registers them into the media_assets table
   * so they immediately appear in the Media Library with usageCount = 1.
   */
  uploadAndRegisterMedia(
    files: RegisterUploadedMediaInput[],
  ): Promise<RegisteredMediaResult[]>;

  /**
   * Synchronizes media usage counts for attached media URLs:
   * - Increments usageCount for added URLs (or registers them in media_assets if not yet present)
   * - Decrements usageCount for removed URLs
   */
  syncMediaUsage(
    currentUrls: string[],
    previousUrls?: string[],
    defaultTitle?: string,
  ): Promise<void>;
}
