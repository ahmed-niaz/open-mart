export class PaymentRefundInitiatedEvent {
  constructor(
    public readonly paymentId: string,
    public readonly orderId: string,
    public readonly refundId: string,
    public readonly refundAmountCents: number,
    public readonly currency: string,
    public readonly reason: string,
    public readonly provider: string,
    public readonly transactionId: string | null,
    public readonly occurredAt: Date = new Date(),
  ) {}
}
