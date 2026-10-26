import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { eq, sql } from 'drizzle-orm';
import {
  DRIZZLE,
  type DrizzleDB,
} from '../../../../shared/infrastructure/database/postgres/drizzle.provider.js';
import { mediaAssetsTable } from '../../../../shared/infrastructure/database/postgres/schema/media.schema.js';
import { productsTable } from '../../../../shared/infrastructure/database/postgres/schema/product.schema.js';
import { GetMediaByIdQuery } from './get-media-by-id.query.js';
import {
  ApplicationException,
  ApplicationExceptionCode,
} from '../../../../shared/domain/exceptions/application.exception.js';
import type { MediaAssetDto } from '../../dto/media-asset.dto.js';

export interface MediaAssetDetailDto extends MediaAssetDto {
  associatedProducts: {
    id: string;
    title: string;
    sku: string;
  }[];
}

@QueryHandler(GetMediaByIdQuery)
export class GetMediaByIdHandler implements IQueryHandler<
  GetMediaByIdQuery,
  MediaAssetDetailDto
> {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  async execute(query: GetMediaByIdQuery): Promise<MediaAssetDetailDto> {
    const [row] = await this.db
      .select()
      .from(mediaAssetsTable)
      .where(eq(mediaAssetsTable.id, query.id))
      .limit(1);

    if (!row) {
      throw new ApplicationException(
        `Media asset with ID '${query.id}' not found.`,
        ApplicationExceptionCode.NOT_FOUND,
      );
    }

    // Find products containing this asset's URL in productsTable.media jsonb array
    const referencingProducts = await this.db
      .select({
        id: productsTable.id,
        title: productsTable.title,
        sku: productsTable.sku,
      })
      .from(productsTable)
      .where(
        sql`EXISTS (
          SELECT 1 FROM jsonb_array_elements(${productsTable.media}) AS m
          WHERE m->>'url' = ${row.url}
        )`,
      );

    return {
      id: row.id,
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
      usageCount: referencingProducts.length,
      isArchived: row.isArchived,
      version: row.version,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
      associatedProducts: referencingProducts,
    };
  }
}
