export interface UploadFileInput {
  buffer: Buffer;
  originalName: string;
  mimeType: string;
  folder?: string;
}

export interface UploadFileOutput {
  url: string;
  key: string;
  fileName: string;
}

export const STORAGE_SERVICE = Symbol('STORAGE_SERVICE');

export interface StoragePort {
  upload(input: UploadFileInput): Promise<UploadFileOutput>;
  uploadMany(inputs: UploadFileInput[]): Promise<UploadFileOutput[]>;
  delete(key: string): Promise<void>;
}
