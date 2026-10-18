export class UpdateCategoryCommand {
  constructor(
    public readonly id: string,
    public readonly name?: string,
    public readonly description?: string,
    public readonly parentId?: string | null,
    public readonly imageUrl?: string | null,
    public readonly displayOrder?: number,
  ) {}
}
