export class OrderCancelledEvent {
  constructor(
    public readonly orderId: string,
    public readonly customerId: string | null,
    public readonly reason: string,
    public readonly occurredAt: Date = new Date(),
  ) {}
}
