import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { count, eq, like, sql } from 'drizzle-orm';
import {
  DRIZZLE,
  type DrizzleDB,
} from '../../../../shared/infrastructure/database/postgres/drizzle.provider.js';
import { mediaAssetsTable } from '../../../../shared/infrastructure/database/postgres/schema/media.schema.js';
import { GetMediaSummaryQuery } from './get-media-summary.query.js';
import type { MediaSummaryDto } from '../../dto/media-asset.dto.js';

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

@QueryHandler(GetMediaSummaryQuery)
export class GetMediaSummaryHandler implements IQueryHandler<
  GetMediaSummaryQuery,
  MediaSummaryDto
> {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  async execute(): Promise<MediaSummaryDto> {
    const [stats] = await this.db
      .select({
        totalFiles: count(),
        totalBytes: sql<string>`COALESCE(SUM(${mediaAssetsTable.fileSizeBytes}), 0)`,
      })
      .from(mediaAssetsTable)
      .where(eq(mediaAssetsTable.isArchived, false));

    const [imageStats] = await this.db
      .select({ count: count() })
      .from(mediaAssetsTable)
      .where(like(mediaAssetsTable.mimeType, 'image/%'));

    const [unusedStats] = await this.db
      .select({ count: count() })
      .from(mediaAssetsTable)
      .where(eq(mediaAssetsTable.usageCount, 0));

    const totalFiles = Number(stats?.totalFiles ?? 0);
    const totalSizeBytes = Number(stats?.totalBytes ?? 0);
    const imageFiles = Number(imageStats?.count ?? 0);
    const unusedFiles = Number(unusedStats?.count ?? 0);

    return {
      totalFiles,
      totalSizeBytes,
      totalSizeFormatted: formatBytes(totalSizeBytes),
      imageFiles,
      unusedFiles,
    };
  }
}
