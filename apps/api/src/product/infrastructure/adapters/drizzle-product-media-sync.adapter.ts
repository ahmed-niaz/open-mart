import { Inject, Injectable, Logger } from '@nestjs/common';
import { eq, sql } from 'drizzle-orm';
import {
  ProductMediaSyncPort,
  RegisterUploadedMediaInput,
  RegisteredMediaResult,
} from '../../application/ports/product-media-sync.port.js';
import {
  STORAGE_SERVICE,
  type StoragePort,
} from '../../../shared/application/ports/storage.port.js';
import { DRIZZLE } from '../../../shared/infrastructure/database/postgres/drizzle.provider.js';
import type { DrizzleDB } from '../../../shared/infrastructure/database/postgres/drizzle.provider.js';
import { mediaAssetsSchema } from '../../../shared/infrastructure/database/postgres/schema/media.schema.js';

@Injectable()
export class DrizzleProductMediaSyncAdapter implements ProductMediaSyncPort {
  private readonly logger = new Logger(DrizzleProductMediaSyncAdapter.name);

  constructor(
    @Inject(STORAGE_SERVICE)
    private readonly storageService: StoragePort,
    @Inject(DRIZZLE)
    private readonly db: DrizzleDB,
  ) {}

  async uploadAndRegisterMedia(
    files: RegisterUploadedMediaInput[],
  ): Promise<RegisteredMediaResult[]> {
    if (!files || files.length === 0) return [];

    const results: RegisteredMediaResult[] = [];

    for (const file of files) {
      try {
        const rawName = file.originalName.replace(/\.[^/.]+$/, '');
        const cleanAltText =
          file.altText || rawName.replace(/[-_]/g, ' ').trim();

        // 1. Upload to Cloudflare R2
        const uploaded = await this.storageService.upload({
          buffer: file.buffer,
          originalName: file.originalName,
          mimeType: file.mimeType,
          folder: file.folder || 'products',
        });

        // 2. Persist in media_assets table with usageCount = 1 so it appears in the Media Library
        await this.db
          .insert(mediaAssetsSchema)
          .values({
            fileName: uploaded.fileName,
            originalName: file.originalName,
            mimeType: file.mimeType,
            fileSizeBytes: file.size,
            url: uploaded.url,
            storageKey: uploaded.key,
            altText: cleanAltText,
            uploadedBy: file.uploadedBy || 'admin:product',
            usageCount: 1,
            isArchived: false,
          })
          .onConflictDoUpdate({
            target: mediaAssetsSchema.storageKey,
            set: {
              usageCount: sql`${mediaAssetsSchema.usageCount} + 1`,
              updatedAt: new Date(),
            },
          });

        this.logger.log(
          `Uploaded and registered product media into Media Library: '${uploaded.key}' (${uploaded.url})`,
        );

        results.push({
          url: uploaded.url,
          storageKey: uploaded.key,
          fileName: uploaded.fileName,
          altText: cleanAltText,
        });
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        this.logger.error(
          `Failed to upload or register file '${file.originalName}': ${msg}`,
        );
        throw err;
      }
    }

    return results;
  }

  async syncMediaUsage(
    currentUrls: string[],
    previousUrls: string[] = [],
    defaultTitle?: string,
  ): Promise<void> {
    const currentSet = new Set(currentUrls.filter(Boolean));
    const previousSet = new Set(previousUrls.filter(Boolean));

    const addedUrls = [...currentSet].filter((url) => !previousSet.has(url));
    const removedUrls = [...previousSet].filter((url) => !currentSet.has(url));

    // 1. Decrement usage_count for removed URLs
    for (const url of removedUrls) {
      try {
        await this.db
          .update(mediaAssetsSchema)
          .set({
            usageCount: sql`GREATEST(0, ${mediaAssetsSchema.usageCount} - 1)`,
            updatedAt: new Date(),
          })
          .where(eq(mediaAssetsSchema.url, url));
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        this.logger.warn(
          `Failed to decrement usage count for url '${url}': ${msg}`,
        );
      }
    }

    // 2. Increment usage_count for newly added URLs (or register them in media_assets if not present)
    for (const url of addedUrls) {
      try {
        const existing = await this.db
          .select({
            id: mediaAssetsSchema.id,
            usageCount: mediaAssetsSchema.usageCount,
          })
          .from(mediaAssetsSchema)
          .where(eq(mediaAssetsSchema.url, url))
          .limit(1);

        if (existing.length > 0) {
          await this.db
            .update(mediaAssetsSchema)
            .set({
              usageCount: sql`${mediaAssetsSchema.usageCount} + 1`,
              updatedAt: new Date(),
            })
            .where(eq(mediaAssetsSchema.url, url));
        } else {
          // URL is not yet in media_assets (e.g. initial image or external link): register it
          let storageKey: string;
          let fileName: string;
          try {
            const urlObj = new URL(url);
            storageKey = urlObj.pathname.replace(/^\/+/, '');
            fileName = storageKey.split('/').pop() || 'product-image.jpg';
          } catch {
            storageKey = url;
            fileName = 'product-image.jpg';
          }

          const altText =
            defaultTitle ||
            fileName.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ');

          await this.db
            .insert(mediaAssetsSchema)
            .values({
              fileName,
              originalName: fileName,
              mimeType: 'image/jpeg',
              fileSizeBytes: 0,
              url,
              storageKey,
              altText,
              uploadedBy: 'system:product-attach',
              usageCount: 1,
              isArchived: false,
            })
            .onConflictDoUpdate({
              target: mediaAssetsSchema.storageKey,
              set: {
                usageCount: sql`${mediaAssetsSchema.usageCount} + 1`,
                updatedAt: new Date(),
              },
            });
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        this.logger.warn(`Failed to sync usage for url '${url}': ${msg}`);
      }
    }
  }
}
