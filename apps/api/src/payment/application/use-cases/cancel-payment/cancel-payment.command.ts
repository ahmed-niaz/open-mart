export class CancelPaymentCommand {
  constructor(
    public readonly orderId: string,
    public readonly reason?: string,
  ) {}
}

