import { IsEnum, IsInt, IsOptional, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { AnalyticsDateRangeDto } from './analytics-date-range.dto.js';

export class TopProductsQueryDto extends AnalyticsDateRangeDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number = 5;

  @IsOptional()
  @IsEnum(['revenue', 'units'], {
    message: "sortBy must be either 'revenue' or 'units'",
  })
  sortBy?: 'revenue' | 'units' = 'revenue';
}
