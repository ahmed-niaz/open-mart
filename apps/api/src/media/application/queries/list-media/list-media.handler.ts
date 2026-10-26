import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { and, asc, count, desc, eq, ilike, like, or } from 'drizzle-orm';
import {
  DRIZZLE,
  type DrizzleDB,
} from '../../../../shared/infrastructure/database/postgres/drizzle.provider.js';
import { mediaAssetsTable } from '../../../../shared/infrastructure/database/postgres/schema/media.schema.js';
import { ListMediaQuery } from './list-media.query.js';
import type { PaginatedMediaResultDto } from '../../dto/media-asset.dto.js';

@QueryHandler(ListMediaQuery)
export class ListMediaHandler implements IQueryHandler<
  ListMediaQuery,
  PaginatedMediaResultDto
> {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  async execute(query: ListMediaQuery): Promise<PaginatedMediaResultDto> {
    const page = Math.max(1, query.page || 1);
    const limit = Math.min(100, Math.max(1, query.limit || 24));
    const offset = (page - 1) * limit;

    const conditions = [];

    // Archive filter
    conditions.push(eq(mediaAssetsTable.isArchived, query.isArchived ?? false));

    // Keyword Search
    if (query.search && query.search.trim() !== '') {
      const term = `%${query.search.trim()}%`;
      conditions.push(
        or(
          ilike(mediaAssetsTable.originalName, term),
          ilike(mediaAssetsTable.altText, term),
          ilike(mediaAssetsTable.fileName, term),
        ),
      );
    }

    // MIME Type filter (e.g. 'image/' or 'image/png')
    if (
      query.mimeType &&
      query.mimeType.trim() !== '' &&
      query.mimeType !== 'all'
    ) {
      const typeTerm = query.mimeType.trim();
      if (typeTerm.endsWith('/')) {
        conditions.push(like(mediaAssetsTable.mimeType, `${typeTerm}%`));
      } else {
        conditions.push(eq(mediaAssetsTable.mimeType, typeTerm));
      }
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    // Sorting
    let sortColumn;
    if (query.sortBy === 'file_size') {
      sortColumn = mediaAssetsTable.fileSizeBytes;
    } else if (query.sortBy === 'original_name') {
      sortColumn = mediaAssetsTable.originalName;
    } else {
      sortColumn = mediaAssetsTable.createdAt;
    }

    const orderByClause =
      query.sortOrder === 'asc' ? asc(sortColumn) : desc(sortColumn);

    // Count
    const totalCountResult = await this.db
      .select({ total: count() })
      .from(mediaAssetsTable)
      .where(whereClause);
    const total = Number(totalCountResult[0]?.total ?? 0);

    // Fetch items
    const rows = await this.db
      .select()
      .from(mediaAssetsTable)
      .where(whereClause)
      .orderBy(orderByClause)
      .limit(limit)
      .offset(offset);

    const items = rows.map((r) => ({
      id: r.id,
      fileName: r.fileName,
      originalName: r.originalName,
      mimeType: r.mimeType,
      fileSizeBytes: r.fileSizeBytes,
      url: r.url,
      storageKey: r.storageKey,
      altText: r.altText,
      width: r.width ?? undefined,
      height: r.height ?? undefined,
      uploadedBy: r.uploadedBy ?? undefined,
      usageCount: r.usageCount,
      isArchived: r.isArchived,
      version: r.version,
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString(),
    }));

    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    };
  }
}
