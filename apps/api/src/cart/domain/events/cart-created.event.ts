export class CartCreatedEvent {
  constructor(
    public readonly cartId: string,
    public readonly customerId: string | null,
    public readonly guestId: string | null,
    public readonly occurredAt: Date = new Date(),
  ) {}
}
