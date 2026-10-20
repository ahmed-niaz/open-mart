export class LowStockDetectedEvent {
  constructor(
    public readonly sku: string,
    public readonly availableQuantity: number,
    public readonly threshold: number,
    public readonly occurredAt: Date = new Date(),
  ) {}
}
