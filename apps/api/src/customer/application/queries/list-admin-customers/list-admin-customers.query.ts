export class ListAdminCustomersQuery {
  constructor(
    public readonly page: number = 1,
    public readonly limit: number = 20,
    public readonly search?: string,
    public readonly isActive?: boolean,
  ) {}

  get offset(): number {
    const p = this.page && this.page > 0 ? this.page : 1;
    const l = this.limit && this.limit > 0 ? this.limit : 20;
    return (p - 1) * l;
  }
}
