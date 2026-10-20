export class StockReservedEvent {
  constructor(
    public readonly orderId: string,
    public readonly sku: string,
    public readonly quantity: number,
    public readonly remainingAvailable: number,
    public readonly occurredAt: Date = new Date(),
  ) {}
}
