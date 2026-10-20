export class CancelOrderCommand {
  constructor(
    public readonly orderId: string,
    public readonly reason: string,
    public readonly requestingCustomerId?: string,
  ) {}
}
