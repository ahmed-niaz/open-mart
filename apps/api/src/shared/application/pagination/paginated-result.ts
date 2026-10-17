export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

export class PaginatedResult<T> {
  constructor(
    public readonly data: T[],
    public readonly meta: PaginationMeta,
  ) {}

  static create<T>(
    data: T[],
    total: number,
    page: number,
    limit: number,
  ): PaginatedResult<T> {
    const safeLimit = Math.max(1, limit);
    const totalPages = Math.ceil(total / safeLimit) || 1;
    const safePage = Math.max(1, page);

    return new PaginatedResult<T>(data, {
      page: safePage,
      limit: safeLimit,
      total,
      totalPages,
      hasNextPage: safePage < totalPages,
      hasPreviousPage: safePage > 1,
    });
  }
}
