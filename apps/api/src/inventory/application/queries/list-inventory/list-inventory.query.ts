export class ListInventoryQuery {
  constructor(
    public readonly search?: string,
    public readonly status?: 'low_stock' | 'out_of_stock' | 'all',
    public readonly page: number = 1,
    public readonly limit: number = 20,
  ) {}
}
