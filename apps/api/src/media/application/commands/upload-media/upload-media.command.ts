export interface RawUploadFile {
  buffer: Buffer;
  originalName: string;
  mimeType: string;
  size: number;
}

export class UploadMediaCommand {
  constructor(
    public readonly files: RawUploadFile[],
    public readonly folder: string = 'media-library',
    public readonly uploadedBy?: string,
  ) {}
}
