export class RefundPaymentCommand {
  constructor(
    public readonly paymentId: string,
    public readonly amountCents: number,
    public readonly reason: string,
    public readonly initiatedBy: string,
    public readonly isOfflinePayout: boolean = false,
    public readonly offlineReference?: string | null,
    public readonly idempotencyKey?: string | null,
  ) {}
}
