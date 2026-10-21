import type {
  DiscountStatusValue,
  DiscountTypeValue,
} from '../../../../shared/infrastructure/database/postgres/schema/discount.schema.js';

export class ListDiscountsQuery {
  constructor(
    public readonly page: number = 1,
    public readonly limit: number = 20,
    public readonly status?: DiscountStatusValue,
    public readonly type?: DiscountTypeValue,
    public readonly search?: string,
  ) {}
}
