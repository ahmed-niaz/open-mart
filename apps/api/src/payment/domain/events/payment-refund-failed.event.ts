export class PaymentRefundFailedEvent {
  constructor(
    public readonly paymentId: string,
    public readonly orderId: string,
    public readonly refundId: string,
    public readonly refundAmountCents: number,
    public readonly currency: string,
    public readonly failureReason: string,
    public readonly occurredAt: Date = new Date(),
  ) {}
}
