import { Inject, Injectable } from '@nestjs/common';
import { and, eq, inArray } from 'drizzle-orm';
import {
  DRIZZLE,
  type DrizzleDB,
} from '../../../shared/infrastructure/database/postgres/drizzle.provider.js';
import {
  mediaAssetsTable,
  type MediaAssetInsertRow,
  type MediaAssetSelectRow,
} from '../../../shared/infrastructure/database/postgres/schema/media.schema.js';
import type { MediaRepositoryPort } from '../../application/ports/media.repository.js';
import { MediaAsset } from '../../domain/entities/media-asset.entity.js';
import { MediaId } from '../../domain/value-objects/media-id.vo.js';
import {
  ApplicationException,
  ApplicationExceptionCode,
} from '../../../shared/domain/exceptions/application.exception.js';

@Injectable()
export class DrizzleMediaRepository implements MediaRepositoryPort {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  async save(asset: MediaAsset): Promise<void> {
    const row: MediaAssetInsertRow = {
      id: asset.id.getValue(),
      fileName: asset.fileName,
      originalName: asset.originalName,
      mimeType: asset.mimeType,
      fileSizeBytes: asset.fileSizeBytes,
      url: asset.url,
      storageKey: asset.storageKey,
      altText: asset.altText,
      width: asset.width,
      height: asset.height,
      uploadedBy: asset.uploadedBy,
      usageCount: asset.usageCount,
      isArchived: asset.isArchived,
      version: asset.version,
      createdAt: asset.createdAt,
      updatedAt: asset.updatedAt,
    };

    const existingRows = await this.db
      .select({ id: mediaAssetsTable.id, version: mediaAssetsTable.version })
      .from(mediaAssetsTable)
      .where(eq(mediaAssetsTable.id, asset.id.getValue()))
      .limit(1);

    if (existingRows.length === 0) {
      await this.db.insert(mediaAssetsTable).values(row);
      return;
    }

    const currentVersion = asset.version;
    const nextVersion = currentVersion + 1;

    const updated = await this.db
      .update(mediaAssetsTable)
      .set({
        fileName: row.fileName,
        originalName: row.originalName,
        mimeType: row.mimeType,
        fileSizeBytes: row.fileSizeBytes,
        url: row.url,
        storageKey: row.storageKey,
        altText: row.altText,
        width: row.width,
        height: row.height,
        uploadedBy: row.uploadedBy,
        usageCount: row.usageCount,
        isArchived: row.isArchived,
        version: nextVersion,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(mediaAssetsTable.id, asset.id.getValue()),
          eq(mediaAssetsTable.version, currentVersion),
        ),
      )
      .returning({ id: mediaAssetsTable.id });

    if (updated.length === 0) {
      throw new ApplicationException(
        `Optimistic lock failure: Media asset '${asset.id.getValue()}' was modified by another process.`,
        ApplicationExceptionCode.CONFLICT,
      );
    }

    asset.incrementVersion();
  }

  async findById(id: MediaId): Promise<MediaAsset | null> {
    const rows = await this.db
      .select()
      .from(mediaAssetsTable)
      .where(eq(mediaAssetsTable.id, id.getValue()))
      .limit(1);

    if (rows.length === 0) return null;
    return this.mapToDomain(rows[0]);
  }

  async findByStorageKey(key: string): Promise<MediaAsset | null> {
    const rows = await this.db
      .select()
      .from(mediaAssetsTable)
      .where(eq(mediaAssetsTable.storageKey, key))
      .limit(1);

    if (rows.length === 0) return null;
    return this.mapToDomain(rows[0]);
  }

  async findByUrl(url: string): Promise<MediaAsset | null> {
    const rows = await this.db
      .select()
      .from(mediaAssetsTable)
      .where(eq(mediaAssetsTable.url, url))
      .limit(1);

    if (rows.length === 0) return null;
    return this.mapToDomain(rows[0]);
  }

  async delete(id: MediaId): Promise<void> {
    await this.db
      .delete(mediaAssetsTable)
      .where(eq(mediaAssetsTable.id, id.getValue()));
  }

  async deleteMany(ids: MediaId[]): Promise<void> {
    if (ids.length === 0) return;
    const rawIds = ids.map((id) => id.getValue());
    await this.db
      .delete(mediaAssetsTable)
      .where(inArray(mediaAssetsTable.id, rawIds));
  }

  private mapToDomain(row: MediaAssetSelectRow): MediaAsset {
    return MediaAsset.rehydrate({
      id: new MediaId(row.id),
      fileName: row.fileName,
      originalName: row.originalName,
      mimeType: row.mimeType,
      fileSizeBytes: row.fileSizeBytes,
      url: row.url,
      storageKey: row.storageKey,
      altText: row.altText,
      width: row.width ?? undefined,
      height: row.height ?? undefined,
      uploadedBy: row.uploadedBy ?? undefined,
      usageCount: row.usageCount,
      isArchived: row.isArchived,
      version: row.version,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    });
  }
}
