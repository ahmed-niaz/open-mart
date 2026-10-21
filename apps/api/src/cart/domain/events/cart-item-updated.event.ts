export class CartItemUpdatedEvent {
  constructor(
    public readonly cartId: string,
    public readonly productId: string,
    public readonly quantity: number,
    public readonly occurredAt: Date = new Date(),
  ) {}
}
