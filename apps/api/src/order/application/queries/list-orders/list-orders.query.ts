export class ListOrdersQuery {
  constructor(
    public readonly page: number = 1,
    public readonly limit: number = 10,
    public readonly status?: string,
    public readonly customerId?: string,
  ) {}
}
