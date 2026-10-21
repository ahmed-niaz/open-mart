import type {
  CustomerEligibilityValue,
  DiscountScopeValue,
  DiscountTypeValue,
} from '../../../../shared/infrastructure/database/postgres/schema/discount.schema.js';

export class CreateDiscountCommand {
  constructor(
    public readonly code: string,
    public readonly name: string,
    public readonly type: DiscountTypeValue,
    public readonly value?: number, // basis points for percentage, poisha for fixed_amount
    public readonly scope: DiscountScopeValue = 'all_products',
    public readonly targetProductIds: string[] = [],
    public readonly targetCategoryIds: string[] = [],
    public readonly customerEligibility: CustomerEligibilityValue = 'all',
    public readonly excludeSaleItems: boolean = false,
    public readonly minOrderAmount: number = 0,
    public readonly maxDiscountAmount?: number,
    public readonly maxUsageLimit?: number,
    public readonly maxUsagePerCustomer: number = 1,
    public readonly startsAt?: Date,
    public readonly expiresAt?: Date,
    public readonly description?: string,
    public readonly createdBy?: string,
    public readonly ipAddress?: string,
    public readonly userAgent?: string,
  ) {}
}
