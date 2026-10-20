export class PaymentNeedsReviewEvent {
  constructor(
    public readonly paymentId: string,
    public readonly orderId: string,
    public readonly provider: string,
    public readonly reason: string,
    public readonly expectedAmount: number,
    public readonly receivedAmount: number,
    public readonly currency: string,
    public readonly occurredAt: Date = new Date(),
  ) {}
}
