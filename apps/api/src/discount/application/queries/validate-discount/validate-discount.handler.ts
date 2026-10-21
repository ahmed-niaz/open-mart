import { Inject } from '@nestjs/common';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { inArray } from 'drizzle-orm';

import { ValidateDiscountQuery } from './validate-discount.query.js';
import {
  DISCOUNT_CALCULATION_PORT,
  type CalculatedDiscountResult,
  type DiscountCalculationPort,
  type OrderItemPriceInfo,
} from '../../../../order/application/ports/discount-calculation.port.js';
import {
  DRIZZLE,
  type DrizzleDB,
} from '../../../../shared/infrastructure/database/postgres/drizzle.provider.js';
import { productsSchema } from '../../../../shared/infrastructure/database/postgres/schema/product.schema.js';
import {
  ApplicationException,
  ApplicationExceptionCode,
} from '../../../../shared/domain/exceptions/application.exception.js';

export interface ValidateDiscountResult {
  valid: boolean;
  discountId: string;
  code: string;
  type: string;
  totalDiscountAmount: number;
  allocatedLines: Array<{
    productId: string;
    allocatedAmount: number;
  }>;
  shippingFeeDiscount: number;
}

@QueryHandler(ValidateDiscountQuery)
export class ValidateDiscountQueryHandler implements IQueryHandler<
  ValidateDiscountQuery,
  ValidateDiscountResult
> {
  constructor(
    @Inject(DISCOUNT_CALCULATION_PORT)
    private readonly discountCalculation: DiscountCalculationPort,
    @Inject(DRIZZLE) private readonly db: DrizzleDB,
  ) {}

  async execute(query: ValidateDiscountQuery): Promise<ValidateDiscountResult> {
    if (!query.items || query.items.length === 0) {
      throw new ApplicationException(
        'Cart items cannot be empty when validating a discount.',
        ApplicationExceptionCode.VALIDATION_ERROR,
      );
    }

    const productIds = query.items.map((i) => i.productId);

    // CRITICAL SECURITY INVARIANT: Zero client price trust!
    // The server loads authoritative prices and categories directly from the database!
    const productRows = await this.db
      .select({
        id: productsSchema.id,
        unitPriceAmount: productsSchema.unitPriceAmount,
        basePriceAmount: productsSchema.basePriceAmount,
        categoryId: productsSchema.categoryId,
        status: productsSchema.status,
      })
      .from(productsSchema)
      .where(inArray(productsSchema.id, productIds));

    const productMap = new Map(productRows.map((p) => [p.id, p]));

    const itemsForCalculation: OrderItemPriceInfo[] = query.items.map(
      (item) => {
        const prod = productMap.get(item.productId);
        if (!prod || prod.status !== 'active') {
          throw new ApplicationException(
            `Product '${item.productId}' is not available in catalog.`,
            ApplicationExceptionCode.NOT_FOUND,
          );
        }

        return {
          productId: prod.id,
          categoryId: prod.categoryId,
          unitPrice: prod.unitPriceAmount,
          quantity: item.quantity,
          basePrice: prod.basePriceAmount,
        };
      },
    );

    const calcResult: CalculatedDiscountResult =
      await this.discountCalculation.calculate({
        code: query.code,
        customerId: query.customerId,
        guestEmail: query.guestEmail,
        items: itemsForCalculation,
        shippingFee: query.shippingFee,
      });

    return {
      valid: true,
      discountId: calcResult.discountId,
      code: calcResult.code,
      type: calcResult.type,
      totalDiscountAmount: calcResult.totalDiscountAmount,
      allocatedLines: calcResult.allocatedLines,
      shippingFeeDiscount: calcResult.shippingFeeDiscount,
    };
  }
}
