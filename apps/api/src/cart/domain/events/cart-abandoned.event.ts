export class CartAbandonedEvent {
  constructor(
    public readonly cartId: string,
    public readonly customerId: string | null,
    public readonly guestId: string | null,
    public readonly itemCount: number,
    public readonly lastActivityAt: Date,
    public readonly occurredAt: Date = new Date(),
  ) {}
}
