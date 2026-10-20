export class PaymentFailedIntegrationEvent {
  constructor(
    public readonly paymentId: string,
    public readonly orderId: string,
    public readonly customerId: string | null,
    public readonly provider: string,
    public readonly failureReason: string,
    public readonly failureCode?: string | null,
    public readonly customerEmail?: string | null,
    public readonly customerName?: string | null,
    public readonly occurredAt: Date = new Date(),
  ) {}
}
