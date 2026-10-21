export class PaymentRefundedEvent {
  constructor(
    public readonly paymentId: string,
    public readonly orderId: string,
    public readonly refundId: string,
    public readonly refundAmountCents: number,
    public readonly totalRefundedCents: number,
    public readonly currency: string,
    public readonly providerRefundId: string,
    public readonly isFullRefund: boolean,
    public readonly occurredAt: Date = new Date(),
  ) {}
}
