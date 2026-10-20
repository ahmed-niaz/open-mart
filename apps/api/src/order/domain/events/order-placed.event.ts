import type { ShippingAddressProps } from '../value-objects/shipping-address.vo.js';

export interface OrderPlacedItemEventPayload {
  productId: string;
  productName: string;
  productSku: string;
  unitPriceAmount: number;
  quantity: number;
}

export class OrderPlacedEvent {
  constructor(
    public readonly orderId: string,
    public readonly customerId: string | null,
    public readonly totalAmount: number,
    public readonly currency: string,
    public readonly shippingAddress: ShippingAddressProps,
    public readonly items: OrderPlacedItemEventPayload[],
    public readonly occurredAt: Date = new Date(),
  ) {}
}
