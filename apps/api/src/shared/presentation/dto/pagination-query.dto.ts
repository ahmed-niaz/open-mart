import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

export class PaginationQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit: number = 20;

  get offset(): number {
    const p = this.page && this.page > 0 ? this.page : 1;
    const l = this.limit && this.limit > 0 ? this.limit : 20;
    return (p - 1) * l;
  }
}
