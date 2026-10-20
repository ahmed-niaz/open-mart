export class StockRestockedEvent {
  constructor(
    public readonly sku: string,
    public readonly quantityAdded: number,
    public readonly newOnHand: number,
    public readonly actorId?: string | null,
    public readonly note?: string | null,
    public readonly occurredAt: Date = new Date(),
  ) {}
}
