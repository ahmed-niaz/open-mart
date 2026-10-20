export class GetInventoryMovementsQuery {
  constructor(
    public readonly sku: string,
    public readonly page: number = 1,
    public readonly limit: number = 20,
  ) {}
}
