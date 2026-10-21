import type {
  CustomerEligibilityValue,
  DiscountScopeValue,
  DiscountTypeValue,
} from '../../../../shared/infrastructure/database/postgres/schema/discount.schema.js';

export class UpdateDiscountCommand {
  constructor(
    public readonly id: string,
    public readonly name?: string,
    public readonly description?: string,
    public readonly code?: string,
    public readonly type?: DiscountTypeValue,
    public readonly value?: number,
    public readonly scope?: DiscountScopeValue,
    public readonly targetProductIds?: string[],
    public readonly targetCategoryIds?: string[],
    public readonly customerEligibility?: CustomerEligibilityValue,
    public readonly excludeSaleItems?: boolean,
    public readonly minOrderAmount?: number,
    public readonly maxDiscountAmount?: number,
    public readonly maxUsageLimit?: number,
    public readonly maxUsagePerCustomer?: number,
    public readonly startsAt?: Date,
    public readonly expiresAt?: Date,
    public readonly updatedBy?: string,
    public readonly ipAddress?: string,
    public readonly userAgent?: string,
  ) {}
}
