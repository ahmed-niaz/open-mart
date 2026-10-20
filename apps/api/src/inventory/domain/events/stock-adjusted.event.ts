export class StockAdjustedEvent {
  constructor(
    public readonly sku: string,
    public readonly delta: number,
    public readonly newOnHand: number,
    public readonly reason: string,
    public readonly actorId?: string | null,
    public readonly note?: string | null,
    public readonly occurredAt: Date = new Date(),
  ) {}
}
