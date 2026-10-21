import { Inject } from '@nestjs/common';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { eq, sql } from 'drizzle-orm';

import { GetDiscountByIdQuery } from './get-discount-by-id.query.js';
import {
  DRIZZLE,
  type DrizzleDB,
} from '../../../../shared/infrastructure/database/postgres/drizzle.provider.js';
import {
  discountsSchema,
  discountRedemptionsSchema,
  discountTargetProductsSchema,
  discountTargetCategoriesSchema,
} from '../../../../shared/infrastructure/database/postgres/schema/discount.schema.js';
import { productsSchema } from '../../../../shared/infrastructure/database/postgres/schema/product.schema.js';
import { categoriesSchema } from '../../../../shared/infrastructure/database/postgres/schema/category.schema.js';
import {
  ApplicationException,
  ApplicationExceptionCode,
} from '../../../../shared/domain/exceptions/application.exception.js';

export interface DiscountDetailResponse {
  id: string;
  code: string;
  name: string;
  description: string | null;
  type: string;
  value: number | null;
  scope: string;
  status: string;
  customerEligibility: string;
  excludeSaleItems: boolean;
  minOrderAmount: number;
  maxDiscountAmount: number | null;
  maxUsageLimit: number | null;
  currentUsageCount: number;
  maxUsagePerCustomer: number;
  startsAt: Date;
  expiresAt: Date | null;
  version: number;
  targetProducts: Array<{ id: string; title: string }>;
  targetCategories: Array<{ id: string; name: string }>;
  totalSavingsAmount: number;
  createdAt: Date;
  updatedAt: Date;
}

@QueryHandler(GetDiscountByIdQuery)
export class GetDiscountByIdQueryHandler implements IQueryHandler<
  GetDiscountByIdQuery,
  DiscountDetailResponse
> {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  async execute(query: GetDiscountByIdQuery): Promise<DiscountDetailResponse> {
    const rows = await this.db
      .select()
      .from(discountsSchema)
      .where(eq(discountsSchema.id, query.id))
      .limit(1);

    if (rows.length === 0) {
      throw new ApplicationException(
        'Discount not found.',
        ApplicationExceptionCode.NOT_FOUND,
      );
    }

    const d = rows[0];

    const [prodRows, catRows, savingsRow] = await Promise.all([
      this.db
        .select({
          id: productsSchema.id,
          title: productsSchema.title,
        })
        .from(discountTargetProductsSchema)
        .innerJoin(
          productsSchema,
          eq(discountTargetProductsSchema.productId, productsSchema.id),
        )
        .where(eq(discountTargetProductsSchema.discountId, d.id)),

      this.db
        .select({
          id: categoriesSchema.id,
          name: categoriesSchema.name,
        })
        .from(discountTargetCategoriesSchema)
        .innerJoin(
          categoriesSchema,
          eq(discountTargetCategoriesSchema.categoryId, categoriesSchema.id),
        )
        .where(eq(discountTargetCategoriesSchema.discountId, d.id)),

      this.db
        .select({
          totalSavings: sql<string>`COALESCE(SUM(${discountRedemptionsSchema.discountAmount}), 0)::text`,
        })
        .from(discountRedemptionsSchema)
        .where(eq(discountRedemptionsSchema.discountId, d.id)),
    ]);

    return {
      id: d.id,
      code: d.code,
      name: d.name,
      description: d.description,
      type: d.type,
      value: d.value,
      scope: d.scope,
      status: d.status,
      customerEligibility: d.customerEligibility,
      excludeSaleItems: d.excludeSaleItems,
      minOrderAmount: d.minOrderAmount,
      maxDiscountAmount: d.maxDiscountAmount,
      maxUsageLimit: d.maxUsageLimit,
      currentUsageCount: d.currentUsageCount,
      maxUsagePerCustomer: d.maxUsagePerCustomer,
      startsAt: d.startsAt,
      expiresAt: d.expiresAt,
      version: d.version,
      targetProducts: prodRows,
      targetCategories: catRows,
      totalSavingsAmount: Number(savingsRow[0]?.totalSavings ?? 0),
      createdAt: d.createdAt,
      updatedAt: d.updatedAt,
    };
  }
}
