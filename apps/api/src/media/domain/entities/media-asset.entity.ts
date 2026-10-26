import { AggregateRoot } from '../../../shared/domain/aggregate-root.js';
import { DomainException } from '../../../shared/domain/exceptions/domain.exception.js';
import { MediaId } from '../value-objects/media-id.vo.js';

export interface MediaAssetProps {
  id: MediaId;
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
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateMediaAssetInput {
  id?: MediaId;
  fileName: string;
  originalName: string;
  mimeType: string;
  fileSizeBytes: number;
  url: string;
  storageKey: string;
  altText?: string;
  width?: number;
  height?: number;
  uploadedBy?: string;
}

export class MediaAsset extends AggregateRoot {
  private _id: MediaId;
  private _fileName: string;
  private _originalName: string;
  private _mimeType: string;
  private _fileSizeBytes: number;
  private _url: string;
  private _storageKey: string;
  private _altText: string;
  private _width?: number;
  private _height?: number;
  private _uploadedBy?: string;
  private _usageCount: number;
  private _isArchived: boolean;
  private _version: number;
  private _createdAt: Date;
  private _updatedAt: Date;

  private constructor(props: MediaAssetProps) {
    super();
    this._id = props.id;
    this._fileName = props.fileName;
    this._originalName = props.originalName;
    this._mimeType = props.mimeType;
    this._fileSizeBytes = props.fileSizeBytes;
    this._url = props.url;
    this._storageKey = props.storageKey;
    this._altText = props.altText;
    this._width = props.width;
    this._height = props.height;
    this._uploadedBy = props.uploadedBy;
    this._usageCount = props.usageCount;
    this._isArchived = props.isArchived;
    this._version = props.version;
    this._createdAt = props.createdAt;
    this._updatedAt = props.updatedAt;
  }

  static create(input: CreateMediaAssetInput): MediaAsset {
    if (!input.fileName || input.fileName.trim().length === 0) {
      throw new DomainException('Media asset fileName cannot be empty.');
    }
    if (!input.url || input.url.trim().length === 0) {
      throw new DomainException('Media asset URL cannot be empty.');
    }
    if (!input.storageKey || input.storageKey.trim().length === 0) {
      throw new DomainException('Media asset storageKey cannot be empty.');
    }

    const now = new Date();
    return new MediaAsset({
      id: input.id ?? new MediaId(),
      fileName: input.fileName.trim(),
      originalName: (input.originalName || input.fileName).trim(),
      mimeType: input.mimeType || 'application/octet-stream',
      fileSizeBytes: input.fileSizeBytes >= 0 ? input.fileSizeBytes : 0,
      url: input.url.trim(),
      storageKey: input.storageKey.trim(),
      altText: input.altText?.trim() ?? '',
      width: input.width,
      height: input.height,
      uploadedBy: input.uploadedBy,
      usageCount: 0,
      isArchived: false,
      version: 1,
      createdAt: now,
      updatedAt: now,
    });
  }

  static rehydrate(props: MediaAssetProps): MediaAsset {
    return new MediaAsset(props);
  }

  updateMetadata(input: { altText?: string; originalName?: string }): void {
    let changed = false;
    if (input.altText !== undefined) {
      this._altText = input.altText.trim();
      changed = true;
    }
    if (
      input.originalName !== undefined &&
      input.originalName.trim().length > 0
    ) {
      this._originalName = input.originalName.trim();
      changed = true;
    }

    if (changed) {
      this._updatedAt = new Date();
    }
  }

  incrementUsage(): void {
    this._usageCount += 1;
    this._updatedAt = new Date();
  }

  decrementUsage(): void {
    this._usageCount = Math.max(0, this._usageCount - 1);
    this._updatedAt = new Date();
  }

  archive(): void {
    this._isArchived = true;
    this._updatedAt = new Date();
  }

  restore(): void {
    this._isArchived = false;
    this._updatedAt = new Date();
  }

  incrementVersion(): void {
    this._version += 1;
  }

  // Getters
  get id(): MediaId {
    return this._id;
  }

  get fileName(): string {
    return this._fileName;
  }

  get originalName(): string {
    return this._originalName;
  }

  get mimeType(): string {
    return this._mimeType;
  }

  get fileSizeBytes(): number {
    return this._fileSizeBytes;
  }

  get url(): string {
    return this._url;
  }

  get storageKey(): string {
    return this._storageKey;
  }

  get altText(): string {
    return this._altText;
  }

  get width(): number | undefined {
    return this._width;
  }

  get height(): number | undefined {
    return this._height;
  }

  get uploadedBy(): string | undefined {
    return this._uploadedBy;
  }

  get usageCount(): number {
    return this._usageCount;
  }

  get isArchived(): boolean {
    return this._isArchived;
  }

  get version(): number {
    return this._version;
  }

  get createdAt(): Date {
    return this._createdAt;
  }

  get updatedAt(): Date {
    return this._updatedAt;
  }
}
