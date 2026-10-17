import { IQuery } from '@nestjs/cqrs';

export interface ListProductFilter {
  isActive?: boolean;
  minPrice?: number;
  maxPrice?: number;
  status?: string;
  category?: string;
  search?: string;
  page?: number;
  limit?: number;
  offset?: number;
}

export class ListProductQuery implements IQuery {
  public readonly isActive?: boolean;
  public readonly minPrice?: number;
  public readonly maxPrice?: number;
  public readonly status?: string;
  public readonly category?: string;
  public readonly search?: string;
  public readonly page: number;
  public readonly limit: number;
  public readonly offset: number;

  constructor(filter?: ListProductFilter) {
    this.isActive = filter?.isActive;
    this.minPrice = filter?.minPrice;
    this.maxPrice = filter?.maxPrice;
    this.status = filter?.status;
    this.category = filter?.category;
    this.search = filter?.search;

    const page = filter?.page && filter.page > 0 ? filter.page : 1;
    const limit = filter?.limit && filter.limit > 0 ? filter.limit : 20;

    this.page = page;
    this.limit = limit;
    this.offset =
      filter?.offset !== undefined ? filter.offset : (page - 1) * limit;
  }
}
