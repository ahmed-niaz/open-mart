export class CartConvertedEvent {
  constructor(
    public readonly cartId: string,
    public readonly orderId: string,
    public readonly occurredAt: Date = new Date(),
  ) {}
}
