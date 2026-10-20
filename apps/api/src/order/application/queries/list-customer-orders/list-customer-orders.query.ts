export class ListCustomerOrdersQuery {
  constructor(
    public readonly customerId: string,
    public readonly page: number = 1,
    public readonly limit: number = 10,
    public readonly status?: string,
  ) {}
}
