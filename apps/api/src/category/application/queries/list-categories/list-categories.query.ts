export class ListCategoriesQuery {
  constructor(
    public readonly page: number = 1,
    public readonly limit: number = 20,
    public readonly search?: string,
    public readonly isActive?: boolean,
    public readonly parentId?: string | null,
  ) {}
}
