export interface ValidateCartItemInput {
  productId: string;
  quantity: number;
}

export class ValidateDiscountQuery {
  constructor(
    public readonly code: string,
    public readonly items: ValidateCartItemInput[],
    public readonly shippingFee: number = 0,
    public readonly customerId?: string,
    public readonly guestEmail?: string,
  ) {}
}
