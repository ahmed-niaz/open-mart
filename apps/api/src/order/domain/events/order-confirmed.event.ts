import type { ShippingAddressProps } from '../value-objects/shipping-address.vo.js';

export class OrderConfirmedEvent {
  constructor(
    public readonly orderId: string,
    public readonly customerId: string | null,
    public readonly totalAmount: number,
    public readonly currency: string,
    public readonly shippingAddress: ShippingAddressProps,
    public readonly occurredAt: Date = new Date(),
  ) {}
}
