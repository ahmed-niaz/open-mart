import { Inject, Injectable } from '@nestjs/common';
import { sql } from 'drizzle-orm';

import {
  type CalculateDiscountParams,
  type CalculatedDiscountResult,
  type DiscountCalculationPort,
} from '../../../order/application/ports/discount-calculation.port.js';
import {
  DISCOUNT_REPOSITORY_PORT,
  type DiscountRepositoryPort,
} from '../../application/ports/discount.repository.port.js';
import {
  DISCOUNT_REDEMPTION_REPOSITORY_PORT,
  type DiscountRedemptionRepositoryPort,
} from '../../application/ports/discount-redemption.repository.port.js';
import {
  DRIZZLE,
  type DrizzleDB,
} from '../../../shared/infrastructure/database/postgres/drizzle.provider.js';
import {
  DiscountAllocation,
  type LineItemForAllocation,
} from '../../domain/value-objects/discount-allocation.vo.js';
import {
  ApplicationException,
  ApplicationExceptionCode,
} from '../../../shared/domain/exceptions/application.exception.js';

@Injectable()
export class DiscountCalculationAdapter implements DiscountCalculationPort {
  constructor(
    @Inject(DRIZZLE)
    private readonly db: DrizzleDB,
    @Inject(DISCOUNT_REPOSITORY_PORT)
    private readonly discountRepo: DiscountRepositoryPort,
    @Inject(DISCOUNT_REDEMPTION_REPOSITORY_PORT)
    private readonly redemptionRepo: DiscountRedemptionRepositoryPort,
  ) {}

  async calculate(
    params: CalculateDiscountParams,
  ): Promise<CalculatedDiscountResult> {
    const discount = await this.discountRepo.findByCode(params.code);
    if (!discount) {
      throw new ApplicationException(
        'Invalid or expired coupon code.',
        ApplicationExceptionCode.NOT_FOUND,
      );
    }

    const validity = discount.isValidNow();
    if (!validity.isValid) {
      throw new ApplicationException(
        validity.reason || 'Invalid or expired coupon code.',
        ApplicationExceptionCode.VALIDATION_ERROR,
      );
    }

    // Customer identification & eligibility check
    const customerIdentifier = params.customerId
      ? params.customerId.toLowerCase()
      : params.guestEmail?.trim().toLowerCase();

    if (!customerIdentifier) {
      throw new ApplicationException(
        'Customer identifier or email is required to apply discounts.',
        ApplicationExceptionCode.VALIDATION_ERROR,
      );
    }

    if (
      discount.customerEligibility === 'registered_only' &&
      !params.customerId
    ) {
      throw new ApplicationException(
        'This discount code is reserved for registered account holders only. Please sign in.',
        ApplicationExceptionCode.UNAUTHORIZED,
      );
    }

    const customerUsageCount = await this.redemptionRepo.countByCustomer(
      discount.id.value,
      customerIdentifier,
    );

    // Filter eligible line items
    const eligibleLines: Array<{
      productId: string;
      lineTotal: number;
    }> = [];

    for (const item of params.items) {
      // If sale items are excluded, check if product is on sale
      if (
        discount.excludeSaleItems &&
        item.basePrice !== undefined &&
        item.basePrice !== null &&
        item.basePrice > item.unitPrice
      ) {
        continue; // Excluded from discount
      }

      if (discount.scope.isEligible(item.productId, item.categoryId)) {
        eligibleLines.push({
          productId: item.productId,
          lineTotal: item.quantity * item.unitPrice,
        });
      }
    }

    const eligibleSubtotal = eligibleLines.reduce(
      (sum, l) => sum + l.lineTotal,
      0,
    );

    const canRedeemCheck = discount.canRedeem(
      customerUsageCount,
      eligibleSubtotal,
    );
    if (!canRedeemCheck.canRedeem) {
      throw new ApplicationException(
        canRedeemCheck.reason || 'Cannot apply coupon to current cart.',
        ApplicationExceptionCode.VALIDATION_ERROR,
      );
    }

    let totalDiscountAmount = 0;
    let shippingFeeDiscount = 0;

    if (discount.value.type === 'free_shipping') {
      shippingFeeDiscount =
        discount.maxDiscountAmount && discount.maxDiscountAmount > 0
          ? Math.min(params.shippingFee, discount.maxDiscountAmount)
          : params.shippingFee;
      totalDiscountAmount = shippingFeeDiscount;
    } else {
      totalDiscountAmount = discount.value.calculateDiscount(
        eligibleSubtotal,
        discount.maxDiscountAmount,
      );
    }

    // Allocate line item discounts using the Largest-Remainder Method
    const lineItemsForAlloc: LineItemForAllocation[] = eligibleLines.map(
      (l) => ({
        productId: l.productId,
        lineTotal: l.lineTotal,
      }),
    );

    const allocatedLines =
      discount.value.type === 'free_shipping'
        ? eligibleLines.map((l) => ({
            productId: l.productId,
            allocatedAmount: 0,
          }))
        : DiscountAllocation.allocateProportionally(
            lineItemsForAlloc,
            totalDiscountAmount,
          );

    return {
      discountId: discount.id.value,
      code: discount.code.value,
      type: discount.value.type,
      totalDiscountAmount,
      allocatedLines,
      shippingFeeDiscount,
    };
  }

  async reserve(
    discountId: string,
    orderId: string,
    customerId: string | null | undefined,
    customerIdentifier: string,
    code: string,
    amount: number,
    tx?: any,
  ): Promise<void> {
    const runInTx = async (trx: any) => {
      const normIdentifier = customerIdentifier.trim().toLowerCase();

      // 1. Enforce transactional advisory lock on (discountId, customerIdentifier)
      await trx.execute(
        sql`SELECT pg_advisory_xact_lock(hashtext(concat(${discountId}::text, ':', ${normIdentifier}::text)))`,
      );

      // 2. Load discount aggregate with version
      const discount = await this.discountRepo.findById(discountId);
      if (!discount) {
        throw new ApplicationException(
          'Discount coupon not found.',
          ApplicationExceptionCode.NOT_FOUND,
        );
      }

      // 3. Re-verify per-customer usage count inside the lock
      const currentCustomerCount = await this.redemptionRepo.countByCustomer(
        discountId,
        normIdentifier,
        trx,
      );

      if (currentCustomerCount >= discount.maxUsagePerCustomer) {
        throw new ApplicationException(
          'You have already reached the maximum redemption limit for this coupon.',
          ApplicationExceptionCode.CONFLICT,
        );
      }

      // 4. Atomically increment global usage count
      const incremented = await this.discountRepo.atomicIncrementUsage(
        discountId,
        discount.version,
        discount.maxUsageLimit,
      );

      if (!incremented) {
        throw new ApplicationException(
          'Coupon usage limit was reached during checkout. Please try another code.',
          ApplicationExceptionCode.CONFLICT,
        );
      }

      // 5. Insert redemption ledger row with status 'reserved'
      await this.redemptionRepo.reserve(
        {
          discountId,
          orderId,
          customerId: customerId ?? null,
          customerIdentifier: normIdentifier,
          discountCode: code,
          discountAmount: amount,
        },
        trx,
      );
    };

    if (tx) {
      await runInTx(tx);
    } else {
      await this.db.transaction(async (trx) => {
        await runInTx(trx);
      });
    }
  }

  async confirm(orderId: string, tx?: any): Promise<void> {
    const runner = tx ?? this.db;
    await this.redemptionRepo.confirm(orderId, runner);
  }

  async release(orderId: string, tx?: any): Promise<void> {
    const runner = tx ?? this.db;
    const released = await this.redemptionRepo.release(orderId, runner);
    if (released) {
      await this.discountRepo.atomicDecrementUsage(released.discountId);
    }
  }
}
