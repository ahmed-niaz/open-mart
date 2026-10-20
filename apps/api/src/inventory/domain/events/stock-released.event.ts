export class StockReleasedEvent {
  constructor(
    public readonly orderId: string,
    public readonly sku: string,
    public readonly quantity: number,
    public readonly reason: string,
    public readonly occurredAt: Date = new Date(),
  ) {}
}
