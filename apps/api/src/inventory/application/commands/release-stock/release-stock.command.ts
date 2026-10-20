export class ReleaseStockCommand {
  constructor(
    public readonly orderId: string,
    public readonly reason: string = 'Order cancelled before confirmation',
  ) {}
}
