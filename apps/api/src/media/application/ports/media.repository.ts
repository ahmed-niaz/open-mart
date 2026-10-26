import { MediaAsset } from '../../domain/entities/media-asset.entity.js';
import { MediaId } from '../../domain/value-objects/media-id.vo.js';

export const MEDIA_REPOSITORY = Symbol('MEDIA_REPOSITORY');

export interface MediaRepositoryPort {
  findById(id: MediaId): Promise<MediaAsset | null>;
  findByStorageKey(key: string): Promise<MediaAsset | null>;
  findByUrl(url: string): Promise<MediaAsset | null>;
  save(asset: MediaAsset): Promise<void>;
  delete(id: MediaId): Promise<void>;
  deleteMany(ids: MediaId[]): Promise<void>;
}
