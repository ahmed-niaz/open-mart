export class ListMediaQuery {
  constructor(
    public readonly page: number = 1,
    public readonly limit: number = 24,
    public readonly search?: string,
    public readonly mimeType?: string,
    public readonly isArchived: boolean = false,
    public readonly sortBy:
      'created_at' | 'file_size' | 'original_name' = 'created_at',
    public readonly sortOrder: 'asc' | 'desc' = 'desc',
  ) {}
}
