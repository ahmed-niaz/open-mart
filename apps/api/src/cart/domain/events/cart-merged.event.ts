export class CartMergedEvent {
  constructor(
    public readonly primaryCartId: string,
    public readonly mergedGuestCartId: string,
    public readonly customerId: string,
    public readonly totalItems: number,
    public readonly occurredAt: Date = new Date(),
  ) {}
}
