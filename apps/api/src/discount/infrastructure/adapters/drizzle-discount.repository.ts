import { Inject, Injectable } from '@nestjs/common';
import { and, eq, sql } from 'drizzle-orm';

import { DiscountRepositoryPort } from '../../application/ports/discount.repository.port.js';
import { Discount } from '../../domain/entities/discount.entity.js';
import { DiscountId } from '../../domain/value-objects/discount-id.vo.js';
import { DiscountCode } from '../../domain/value-objects/discount-code.vo.js';
import { DiscountValue } from '../../domain/value-objects/discount-value.vo.js';
import { DiscountScopeVO } from '../../domain/value-objects/discount-scope.vo.js';
import {
  DRIZZLE,
  type DrizzleDB,
} from '../../../shared/infrastructure/database/postgres/drizzle.provider.js';
import {
  discountsSchema,
  discountTargetCategoriesSchema,
  discountTargetProductsSchema,
} from '../../../shared/infrastructure/database/postgres/schema/discount.schema.js';
import {
  ApplicationException,
  ApplicationExceptionCode,
} from '../../../shared/domain/exceptions/application.exception.js';

const isUuid = (val?: string): val is string =>
  Boolean(
    val &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      val,
    ),
  );

@Injectable()
export class DrizzleDiscountRepository implements DiscountRepositoryPort {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  async findById(id: string): Promise<Discount | null> {
    const rows = await this.db
      .select()
      .from(discountsSchema)
      .where(eq(discountsSchema.id, id))
      .limit(1);

    if (rows.length === 0) {
      return null;
    }

    return this.mapToDomain(rows[0]);
  }

  async findByCode(code: string): Promise<Discount | null> {
    const normalized = code.trim().toLowerCase();

    const rows = await this.db
      .select()
      .from(discountsSchema)
      .where(sql`lower(trim(${discountsSchema.code})) = ${normalized}`)
      .limit(1);

    if (rows.length === 0) {
      return null;
    }

    return this.mapToDomain(rows[0]);
  }

  async save(discount: Discount): Promise<void> {
    await this.db.transaction(async (tx) => {
      const existing = await tx
        .select({
          id: discountsSchema.id,
          version: discountsSchema.version,
        })
        .from(discountsSchema)
        .where(eq(discountsSchema.id, discount.id.value))
        .limit(1);

      if (existing.length === 0) {
        // Insert new discount
        await tx.insert(discountsSchema).values({
          id: discount.id.value,
          code: discount.code.value,
          name: discount.name,
          description: discount.description || null,
          type: discount.value.type,
          value: discount.value.rawValue,
          scope: discount.scope.scope,
          status: discount.status,
          customerEligibility: discount.customerEligibility,
          excludeSaleItems: discount.excludeSaleItems,
          minOrderAmount: discount.minOrderAmount,
          maxDiscountAmount: discount.maxDiscountAmount || null,
          maxUsageLimit: discount.maxUsageLimit || null,
          currentUsageCount: discount.currentUsageCount,
          maxUsagePerCustomer: discount.maxUsagePerCustomer,
          startsAt: discount.startsAt,
          expiresAt: discount.expiresAt || null,
          version: discount.version,
          createdBy: isUuid(discount.createdBy) ? discount.createdBy : null,
          updatedBy: isUuid(discount.updatedBy) ? discount.updatedBy : null,
          createdAt: discount.createdAt,
          updatedAt: discount.updatedAt,
        });
      } else {
        // Optimistic Concurrency Control (OCC)
        const currentVersion = discount.version;
        const nextVersion = currentVersion + 1;

        const updated = await tx
          .update(discountsSchema)
          .set({
            code: discount.code.value,
            name: discount.name,
            description: discount.description || null,
            type: discount.value.type,
            value: discount.value.rawValue,
            scope: discount.scope.scope,
            status: discount.status,
            customerEligibility: discount.customerEligibility,
            excludeSaleItems: discount.excludeSaleItems,
            minOrderAmount: discount.minOrderAmount,
            maxDiscountAmount: discount.maxDiscountAmount || null,
            maxUsageLimit: discount.maxUsageLimit || null,
            currentUsageCount: discount.currentUsageCount,
            maxUsagePerCustomer: discount.maxUsagePerCustomer,
            startsAt: discount.startsAt,
            expiresAt: discount.expiresAt || null,
            version: nextVersion,
            updatedBy: isUuid(discount.updatedBy) ? discount.updatedBy : null,
            updatedAt: discount.updatedAt,
          })
          .where(
            and(
              eq(discountsSchema.id, discount.id.value),
              eq(discountsSchema.version, currentVersion),
            ),
          )
          .returning({ id: discountsSchema.id });

        if (updated.length === 0) {
          throw new ApplicationException(
            'Discount was updated by another process. Please refresh and try again.',
            ApplicationExceptionCode.CONFLICT,
          );
        }
      }

      // Sync join tables for specific scopes
      await tx
        .delete(discountTargetProductsSchema)
        .where(eq(discountTargetProductsSchema.discountId, discount.id.value));
      if (
        discount.scope.scope === 'specific_products' &&
        discount.scope.targetProductIds.length > 0
      ) {
        await tx.insert(discountTargetProductsSchema).values(
          discount.scope.targetProductIds.map((pId) => ({
            discountId: discount.id.value,
            productId: pId,
          })),
        );
      }

      await tx
        .delete(discountTargetCategoriesSchema)
        .where(
          eq(discountTargetCategoriesSchema.discountId, discount.id.value),
        );
      if (
        discount.scope.scope === 'specific_categories' &&
        discount.scope.targetCategoryIds.length > 0
      ) {
        await tx.insert(discountTargetCategoriesSchema).values(
          discount.scope.targetCategoryIds.map((cId) => ({
            discountId: discount.id.value,
            categoryId: cId,
          })),
        );
      }
    });
  }

  async atomicIncrementUsage(
    discountId: string,
    currentVersion: number,
    maxUsageLimit?: number,
  ): Promise<boolean> {
    const result = await this.db.execute(sql`
      UPDATE discounts
      SET current_usage_count = current_usage_count + 1,
          version = version + 1,
          updated_at = NOW()
      WHERE id = ${discountId}::uuid
        AND version = ${currentVersion}
        AND (${maxUsageLimit ?? null}::int IS NULL OR current_usage_count < ${maxUsageLimit ?? null}::int)
      RETURNING id
    `);

    return (result as any).length > 0;
  }

  async atomicDecrementUsage(discountId: string): Promise<void> {
    await this.db.execute(sql`
      UPDATE discounts
      SET current_usage_count = GREATEST(0, current_usage_count - 1),
          version = version + 1,
          updated_at = NOW()
      WHERE id = ${discountId}::uuid
        AND current_usage_count > 0
      RETURNING id
    `);
  }

  private async mapToDomain(row: any): Promise<Discount> {
    let scopeVO: DiscountScopeVO;

    if (row.scope === 'specific_products') {
      const prodRows = await this.db
        .select({ productId: discountTargetProductsSchema.productId })
        .from(discountTargetProductsSchema)
        .where(eq(discountTargetProductsSchema.discountId, row.id));
      scopeVO = DiscountScopeVO.specificProducts(
        prodRows.map((r) => r.productId),
      );
    } else if (row.scope === 'specific_categories') {
      const catRows = await this.db
        .select({ categoryId: discountTargetCategoriesSchema.categoryId })
        .from(discountTargetCategoriesSchema)
        .where(eq(discountTargetCategoriesSchema.discountId, row.id));
      scopeVO = DiscountScopeVO.specificCategories(
        catRows.map((r) => r.categoryId),
      );
    } else {
      scopeVO = DiscountScopeVO.allProducts();
    }

    let valueVO: DiscountValue;
    if (row.type === 'percentage') {
      valueVO = DiscountValue.percentage(row.value);
    } else if (row.type === 'fixed_amount') {
      valueVO = DiscountValue.fixedAmount(row.value);
    } else {
      valueVO = DiscountValue.freeShipping();
    }

    return Discount.reconstitute({
      id: DiscountId.fromString(row.id),
      code: DiscountCode.create(row.code),
      name: row.name,
      description: row.description || undefined,
      value: valueVO,
      scope: scopeVO,
      status: row.status,
      customerEligibility: row.customerEligibility,
      excludeSaleItems: row.excludeSaleItems,
      minOrderAmount: row.minOrderAmount,
      maxDiscountAmount: row.maxDiscountAmount || undefined,
      maxUsageLimit: row.maxUsageLimit || undefined,
      currentUsageCount: row.currentUsageCount,
      maxUsagePerCustomer: row.maxUsagePerCustomer,
      startsAt: row.startsAt,
      expiresAt: row.expiresAt || undefined,
      version: row.version,
      createdBy: row.createdBy || undefined,
      updatedBy: row.updatedBy || undefined,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    });
  }
}
