export class InitiatePaymentCommand {
  constructor(
    public readonly orderId: string,
    public readonly provider: 'stripe' | 'cod' | 'sslcommerz',
    public readonly idempotencyKey?: string,
    public readonly customerEmail?: string,
  ) {}
}

