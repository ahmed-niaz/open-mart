export const DISCOUNT_REDEMPTION_REPOSITORY_PORT = Symbol(
  'DISCOUNT_REDEMPTION_REPOSITORY_PORT',
);

export interface ReserveRedemptionProps {
  discountId: string;
  orderId: string;
  customerId?: string | null;
  customerIdentifier: string;
  discountCode: string;
  discountAmount: number;
}

export interface DiscountRedemptionRepositoryPort {
  countByCustomer(
    discountId: string,
    customerIdentifier: string,
    tx?: any,
  ): Promise<number>;
  reserve(props: ReserveRedemptionProps, tx?: any): Promise<void>;
  confirm(orderId: string, tx?: any): Promise<void>;
  release(orderId: string, tx?: any): Promise<{ discountId: string } | null>;
}
