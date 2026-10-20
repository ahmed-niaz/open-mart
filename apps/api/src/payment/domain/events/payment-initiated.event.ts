export class PaymentInitiatedEvent {
  constructor(
    public readonly paymentId: string,
    public readonly orderId: string,
    public readonly customerId: string | null,
    public readonly provider: string,
    public readonly amount: number, // in minor currency units (cents)
    public readonly currency: string,
    public readonly transactionId?: string | null,
    public readonly occurredAt: Date = new Date(),
  ) {}
}
