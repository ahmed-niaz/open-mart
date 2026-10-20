export class RestockCommand {
  constructor(
    public readonly sku: string,
    public readonly quantity: number,
    public readonly actorId?: string | null,
    public readonly note?: string | null,
  ) {}
}
