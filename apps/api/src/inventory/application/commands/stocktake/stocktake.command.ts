export class StocktakeCommand {
  constructor(
    public readonly sku: string,
    public readonly countedQuantity: number,
    public readonly actorId?: string | null,
    public readonly note?: string | null,
  ) {}
}
