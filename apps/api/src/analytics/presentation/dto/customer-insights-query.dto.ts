import { IsInt, IsOptional, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { AnalyticsDateRangeDto } from './analytics-date-range.dto.js';

export class CustomerInsightsQueryDto extends AnalyticsDateRangeDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number = 5;
}
