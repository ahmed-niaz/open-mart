export class UpdateCartItemQuantityCommand {
  constructor(
    public readonly productId: string,
    public readonly quantity: number,
    public readonly customerId?: string | null,
    public readonly guestId?: string | null,
  ) {}
}
