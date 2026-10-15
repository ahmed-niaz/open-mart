import { IQuery } from '@nestjs/cqrs';

export interface ListProductFilter {
  isActive?: boolean;
  minPrice?: number;
  maxPrice?: number;
  status?: string;
  category?: string;
  search?: string;
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
  public readonly limit?: number;
  public readonly offset?: number;

  constructor(
    isActiveOrFilter?: boolean | ListProductFilter,
    minPrice?: number,
    maxPrice?: number,
    status?: string,
    category?: string,
  ) {
    if (typeof isActiveOrFilter === 'object' && isActiveOrFilter !== null) {
      this.isActive = isActiveOrFilter.isActive;
      this.minPrice = isActiveOrFilter.minPrice;
      this.maxPrice = isActiveOrFilter.maxPrice;
      this.status = isActiveOrFilter.status;
      this.category = isActiveOrFilter.category;
      this.search = isActiveOrFilter.search;
      this.limit = isActiveOrFilter.limit;
      this.offset = isActiveOrFilter.offset;
    } else {
      this.isActive = isActiveOrFilter;
      this.minPrice = minPrice;
      this.maxPrice = maxPrice;
      this.status = status;
      this.category = category;
    }
  }
}
