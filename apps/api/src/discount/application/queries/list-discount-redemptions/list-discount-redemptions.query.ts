export class ListDiscountRedemptionsQuery {
  constructor(
    public readonly discountId: string,
    public readonly page: number = 1,
    public readonly limit: number = 20,
  ) {}
}
