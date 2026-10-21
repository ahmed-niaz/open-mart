export class RemoveItemFromCartCommand {
  constructor(
    public readonly productId: string,
    public readonly customerId?: string | null,
    public readonly guestId?: string | null,
  ) {}
}
