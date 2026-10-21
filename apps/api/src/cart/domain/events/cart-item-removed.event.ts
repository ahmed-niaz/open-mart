export class CartItemRemovedEvent {
  constructor(
    public readonly cartId: string,
    public readonly productId: string,
    public readonly remainingItems: number,
    public readonly occurredAt: Date = new Date(),
  ) {}
}
