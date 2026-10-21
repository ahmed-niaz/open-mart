export class CartClearedEvent {
  constructor(
    public readonly cartId: string,
    public readonly occurredAt: Date = new Date(),
  ) {}
}
