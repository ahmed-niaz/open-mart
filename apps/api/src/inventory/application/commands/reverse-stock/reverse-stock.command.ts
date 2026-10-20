export class ReverseStockCommand {
  constructor(
    public readonly orderId: string,
    public readonly reason: string = 'Order cancelled after confirmation',
  ) {}
}
