export class AdjustStockCommand {
  constructor(
    public readonly sku: string,
    public readonly delta: number,
    public readonly reason: 'damaged' | 'loss',
    public readonly actorId?: string | null,
    public readonly note?: string | null,
  ) {}
}
