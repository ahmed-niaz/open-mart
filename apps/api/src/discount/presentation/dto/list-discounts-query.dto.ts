import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import type {
  DiscountStatusValue,
  DiscountTypeValue,
} from '../../../shared/infrastructure/database/postgres/schema/discount.schema.js';

export class ListDiscountsQueryDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  page: number = 1;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  @IsOptional()
  limit: number = 20;

  @IsIn(['draft', 'active', 'paused', 'archived'])
  @IsOptional()
  status?: DiscountStatusValue;

  @IsIn(['percentage', 'fixed_amount', 'free_shipping'])
  @IsOptional()
  type?: DiscountTypeValue;

  @IsString()
  @IsOptional()
  search?: string;
}
