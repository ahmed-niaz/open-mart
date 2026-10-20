export class ReturnStockCommand {
  constructor(
    public readonly orderId: string,
    public readonly reason: string = 'Customer returned order item',
  ) {}
}
