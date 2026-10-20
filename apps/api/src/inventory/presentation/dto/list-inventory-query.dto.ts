import { IsIn, IsInt, IsOptional, IsString, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class ListInventoryQueryDto {
  @IsString()
  @IsOptional()
  search?: string;

  @IsString()
  @IsIn(['low_stock', 'out_of_stock', 'all'])
  @IsOptional()
  status?: 'low_stock' | 'out_of_stock' | 'all';

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  page: number = 1;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  limit: number = 20;
}
