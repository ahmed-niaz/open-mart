import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { Inject, Logger } from '@nestjs/common';
import {
  and,
  count,
  desc,
  eq,
  gte,
  ilike,
  lte,
  or,
  sql,
  type SQL,
} from 'drizzle-orm';
import {
  DRIZZLE,
  type DrizzleDB,
} from '../../../../shared/infrastructure/database/postgres/drizzle.provider.js';
import { productsTable } from '../../../../shared/infrastructure/database/postgres/schema/product.schema.js';
import { categoriesSchema } from '../../../../shared/infrastructure/database/postgres/schema/category.schema.js';
import { PaginatedResult } from '../../../../shared/application/pagination/paginated-result.js';
import { ProductResponseDto } from '../../dto/product-response.dto.js';
import { ListProductQuery } from './list-product.query.js';
import { CacheService } from '../../../../shared/infrastructure/cache/cache.service.js';
import {
  expandCatalogSearchTerms,
  type ExpandedCatalogSearch,
} from '../../search/catalog-search-expander.js';

function escapeLikePattern(value: string): string {
  return value.replace(/[\\%_]/g, '\\$&');
}

function isUndefinedPgOperatorOrFunction(error: unknown): boolean {
  const err = error as { code?: string; cause?: { code?: string } } | null;
  return err?.code === '42883' || err?.cause?.code === '42883';
}

function buildSubstringSearchCondition(terms: string[]): SQL | undefined {
  const termConditions: SQL[] = [];
  for (const term of terms) {
    const pattern = `%${escapeLikePattern(term)}%`;
    termConditions.push(
      ilike(productsTable.title, pattern),
      ilike(productsTable.sku, pattern),
      ilike(productsTable.description, pattern),
      sql`CAST(${productsTable.tags} AS text) ILIKE ${pattern}`,
      ilike(categoriesSchema.name, pattern),
    );
  }
  return termConditions.length > 0 ? or(...termConditions) : undefined;
}

function buildTrigramSearchCondition(
  expanded: ExpandedCatalogSearch,
): SQL | undefined {
  const conditions: SQL[] = [];

  for (const term of expanded.expandedTerms) {
    const pattern = `%${escapeLikePattern(term)}%`;
    conditions.push(
      ilike(productsTable.title, pattern),
      ilike(productsTable.sku, pattern),
      ilike(productsTable.description, pattern),
      sql`CAST(${productsTable.tags} AS text) ILIKE ${pattern}`,
      ilike(categoriesSchema.name, pattern),
    );
  }

  for (const term of expanded.trigramTerms) {
    conditions.push(
      sql`(${productsTable.title} % ${term} OR ${term} <% ${productsTable.title})`,
      sql`${productsTable.sku} % ${term}`,
      sql`(${productsTable.description} % ${term} OR ${term} <% ${productsTable.description})`,
      sql`(COALESCE(${categoriesSchema.name}, '') % ${term} OR ${term} <% COALESCE(${categoriesSchema.name}, ''))`,
    );
  }

  return conditions.length > 0 ? or(...conditions) : undefined;
}

function buildTrigramRelevanceScore(expanded: ExpandedCatalogSearch): SQL {
  const primary = expanded.primaryTerm;
  const primaryPattern = `%${escapeLikePattern(primary)}%`;

  const scoreParts: SQL[] = [
    sql`(CASE WHEN LOWER(${productsTable.sku}) = ${primary} THEN 10.0 ELSE 0.0 END)`,
    sql`(CASE WHEN ${productsTable.title} ILIKE ${primaryPattern} THEN 4.0 ELSE 0.0 END)`,
    sql`(CASE WHEN COALESCE(${categoriesSchema.name}, '') ILIKE ${primaryPattern} THEN 1.8 ELSE 0.0 END)`,
    sql`(CASE WHEN ${productsTable.description} ILIKE ${primaryPattern} OR CAST(${productsTable.tags} AS text) ILIKE ${primaryPattern} THEN 0.8 ELSE 0.0 END)`,
  ];

  if (primary.length >= 3) {
    scoreParts.push(
      sql`(GREATEST(word_similarity(${primary}, ${productsTable.title}), similarity(${productsTable.title}, ${primary}) * 1.2) * 3.0)`,
      sql`(word_similarity(${primary}, COALESCE(${categoriesSchema.name}, '')) * 1.5)`,
      sql`(similarity(${productsTable.sku}, ${primary}) * 2.0)`,
    );
  }

  // Secondary expanded Banglish / Bengali / phonetic variants
  for (const variant of expanded.expandedTerms.slice(1)) {
    const variantPattern = `%${escapeLikePattern(variant)}%`;
    scoreParts.push(
      sql`(CASE WHEN ${productsTable.title} ILIKE ${variantPattern} THEN 2.5 ELSE 0.0 END)`,
      sql`(CASE WHEN COALESCE(${categoriesSchema.name}, '') ILIKE ${variantPattern} OR CAST(${productsTable.tags} AS text) ILIKE ${variantPattern} THEN 1.2 ELSE 0.0 END)`,
    );

    if (variant.length >= 3) {
      scoreParts.push(
        sql`(GREATEST(word_similarity(${variant}, ${productsTable.title}), similarity(${productsTable.title}, ${variant})) * 2.0)`,
      );
    }
  }

  return sql.join(scoreParts, sql` + `);
}

@QueryHandler(ListProductQuery)
export class ListProductHandler implements IQueryHandler<
  ListProductQuery,
  PaginatedResult<ProductResponseDto>
> {
  private readonly logger = new Logger(ListProductHandler.name);

  constructor(
    @Inject(DRIZZLE) private readonly db: DrizzleDB,
    private readonly cacheService: CacheService,
  ) {}

  async execute(
    query: ListProductQuery,
  ): Promise<PaginatedResult<ProductResponseDto>> {
    const page = Math.max(1, query.page ?? 1);
    const limit = Math.max(1, Math.min(query.limit ?? 20, 100));
    const status =
      query.status !== undefined && query.status.trim() !== ''
        ? query.status.toLowerCase()
        : query.isActive !== undefined
          ? query.isActive
            ? 'active'
            : 'draft'
          : 'active';
    const rawSearch = query.search?.trim() ?? '';
    const expandedSearch = expandCatalogSearchTerms(rawSearch);
    const category = query.category?.trim().toLowerCase() ?? '';
    const minPrice = query.minPrice ?? null;
    const maxPrice = query.maxPrice ?? null;

    const cacheKey = `product:list:${JSON.stringify({
      page,
      limit,
      status,
      search: expandedSearch.primaryTerm,
      category,
      minPrice,
      maxPrice,
    })}`;

    return this.cacheService.getOrSet(
      cacheKey,
      async () => {
        const baseConditions: SQL[] = [];

        // 1. Status Filter
        if (status !== 'all') {
          baseConditions.push(eq(productsTable.status, status));
        }

        // 2. Price Range Filters
        if (minPrice !== null) {
          baseConditions.push(gte(productsTable.unitPriceAmount, minPrice));
        }

        if (maxPrice !== null) {
          baseConditions.push(lte(productsTable.unitPriceAmount, maxPrice));
        }

        // 3. Category Filter (supports slug, UUID categoryId, or category name)
        if (category.length > 0) {
          const isUuid =
            /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
              category,
            );

          const categoryFilterConditions = [
            eq(categoriesSchema.slug, category),
            ilike(categoriesSchema.name, category),
          ];

          if (isUuid) {
            categoryFilterConditions.push(
              eq(productsTable.categoryId, category),
            );
          }

          const categoryOr = or(...categoryFilterConditions);
          if (categoryOr) {
            baseConditions.push(categoryOr);
          }
        }

        const runCatalogQuery = async (useTrigram: boolean) => {
          const conditions = [...baseConditions];
          let orderClauses: SQL[] = [desc(productsTable.createdAt)];

          if (expandedSearch.expandedTerms.length > 0) {
            const searchCondition = useTrigram
              ? buildTrigramSearchCondition(expandedSearch)
              : buildSubstringSearchCondition(expandedSearch.expandedTerms);
            if (searchCondition) {
              conditions.push(searchCondition);
            }

            if (useTrigram) {
              const relevanceExpr = buildTrigramRelevanceScore(expandedSearch);
              orderClauses = [
                desc(relevanceExpr),
                desc(productsTable.createdAt),
              ];
            }
          }

          const whereClause =
            conditions.length > 0 ? and(...conditions) : undefined;

          const [countResult] = await this.db
            .select({ total: count() })
            .from(productsTable)
            .leftJoin(
              categoriesSchema,
              eq(productsTable.categoryId, categoriesSchema.id),
            )
            .where(whereClause);

          const total = Number(countResult?.total ?? 0);

          const rows = await this.db
            .select({
              product: productsTable,
              category: {
                id: categoriesSchema.id,
                name: categoriesSchema.name,
                slug: categoriesSchema.slug,
              },
            })
            .from(productsTable)
            .leftJoin(
              categoriesSchema,
              eq(productsTable.categoryId, categoriesSchema.id),
            )
            .where(whereClause)
            .orderBy(...orderClauses)
            .limit(limit)
            .offset((page - 1) * limit);

          return { total, rows };
        };

        let result: {
          total: number;
          rows: Array<{
            product: typeof productsTable.$inferSelect;
            category: {
              id: string | null;
              name: string | null;
              slug: string | null;
            } | null;
          }>;
        };

        try {
          result = await runCatalogQuery(true);
        } catch (error) {
          if (
            expandedSearch.expandedTerms.length > 0 &&
            isUndefinedPgOperatorOrFunction(error)
          ) {
            this.logger.warn(
              'pg_trgm extension not active yet; falling back to Banglish-expanded ILIKE search.',
            );
            result = await runCatalogQuery(false);
          } else {
            throw error;
          }
        }

        const dtos = result.rows.map(({ product, category: cat }) =>
          ProductResponseDto.fromPersistence(
            product,
            cat?.id
              ? {
                  id: cat.id,
                  name: cat.name ?? '',
                  slug: cat.slug ?? '',
                }
              : null,
          ),
        );

        return PaginatedResult.create(dtos, result.total, page, limit);
      },
      60, // 60-second TTL with single-flight stampede protection
    );
  }
}
