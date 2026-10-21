export interface OrderItemPriceInfo {
  productId: string;
  categoryId?: string | null;
  unitPrice: number; // in poisha
  quantity: number;
  basePrice?: number | null;
}

export interface CalculateDiscountParams {
  code: string;
  customerId?: string | null;
  guestEmail?: string | null;
  items: OrderItemPriceInfo[];
  shippingFee: number;
}

export interface AllocatedLineDiscount {
  productId: string;
  allocatedAmount: number; // in poisha
}

export interface CalculatedDiscountResult {
  discountId: string;
  code: string;
  type: 'percentage' | 'fixed_amount' | 'free_shipping';
  totalDiscountAmount: number; // in poisha
  allocatedLines: AllocatedLineDiscount[];
  shippingFeeDiscount: number;
}

export const DISCOUNT_CALCULATION_PORT = Symbol('DISCOUNT_CALCULATION_PORT');

export interface DiscountCalculationPort {
  calculate(params: CalculateDiscountParams): Promise<CalculatedDiscountResult>;
  reserve(
    discountId: string,
    orderId: string,
    customerId: string | null | undefined,
    customerIdentifier: string,
    code: string,
    amount: number,
    tx?: any,
  ): Promise<void>;
  confirm(orderId: string, tx?: any): Promise<void>;
  release(orderId: string, tx?: any): Promise<void>;
}
