export interface MediaCleanupJobPayload {
  storageKey: string;
  mediaId?: string;
  reason?: string;
}

export const MEDIA_CLEANUP_PORT = Symbol('MEDIA_CLEANUP_PORT');

export interface MediaCleanupPort {
  enqueueStorageDelete(payload: MediaCleanupJobPayload): Promise<void>;
}
