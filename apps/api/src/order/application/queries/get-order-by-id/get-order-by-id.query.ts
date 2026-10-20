export class GetOrderByIdQuery {
  constructor(
    public readonly orderId: string,
    public readonly requestingCustomerId?: string,
    public readonly isAdmin: boolean = false,
  ) {}
}
