export class StockCommittedEvent {
  constructor(
    public readonly orderId: string,
    public readonly sku: string,
    public readonly quantity: number,
    public readonly newOnHand: number,
    public readonly occurredAt: Date = new Date(),
  ) {}
}
