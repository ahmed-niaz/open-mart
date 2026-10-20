export class PaymentCancelledEvent {
  constructor(
    public readonly paymentId: string,
    public readonly orderId: string,
    public readonly reason: string,
    public readonly occurredAt: Date = new Date(),
  ) {}
}

