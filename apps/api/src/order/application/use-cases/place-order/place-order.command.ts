import type { ShippingAddressProps } from '../../../domain/value-objects/shipping-address.vo.js';

export interface PlaceOrderItemInput {
  productId: string;
  quantity: number;
}

export interface GuestCustomerInput {
  email: string;
  name: string;
  phone?: string;
}

export class PlaceOrderCommand {
  constructor(
    public readonly customerId: string | null,
    public readonly items: PlaceOrderItemInput[],
    public readonly shippingAddress: ShippingAddressProps,
    public readonly idempotencyKey?: string | null,
    public readonly guestCustomer?: GuestCustomerInput | null,
    public readonly notes?: string | null,
  ) {}
}
