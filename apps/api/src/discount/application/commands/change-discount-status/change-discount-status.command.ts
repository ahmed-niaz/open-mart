import type { DiscountStatusValue } from '../../../../shared/infrastructure/database/postgres/schema/discount.schema.js';

export class ChangeDiscountStatusCommand {
  constructor(
    public readonly id: string,
    public readonly status: DiscountStatusValue,
    public readonly updatedBy?: string,
    public readonly userRole?: string,
    public readonly ipAddress?: string,
    public readonly userAgent?: string,
  ) {}
}
