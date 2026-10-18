export class CreateCategoryCommand {
  constructor(
    public readonly name: string,
    public readonly description?: string,
    public readonly parentId?: string,
    public readonly imageUrl?: string,
    public readonly displayOrder?: number,
    public readonly isActive?: boolean,
  ) {}
}
