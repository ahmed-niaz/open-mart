export class ListCustomersQuery {
  constructor(
    public readonly page: number = 1,
    public readonly limit: number = 20,
    public readonly search?: string,
    public readonly isActive?: boolean,
  ) {}

  get offset(): number {
    return (Math.max(1, this.page) - 1) * Math.max(1, this.limit);
  }
}
