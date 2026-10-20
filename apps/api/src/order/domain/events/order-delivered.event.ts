export class OrderDeliveredEvent {
  constructor(
    public readonly orderId: string,
    public readonly customerId: string | null,
    public readonly occurredAt: Date = new Date(),
  ) {}
}
