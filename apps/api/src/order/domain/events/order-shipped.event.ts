export class OrderShippedEvent {
  constructor(
    public readonly orderId: string,
    public readonly customerId: string | null,
    public readonly trackingNumber: string,
    public readonly courierName?: string | null,
    public readonly occurredAt: Date = new Date(),
  ) {}
}
