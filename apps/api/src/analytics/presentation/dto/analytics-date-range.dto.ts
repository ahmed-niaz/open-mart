import { IsEnum, IsISO8601, IsOptional, ValidateIf } from 'class-validator';
import type { AnalyticsPeriod } from '../../infrastructure/utils/analytics-date.helper.js';

export const ANALYTICS_PERIODS: AnalyticsPeriod[] = [
  'today',
  'yesterday',
  '7d',
  '30d',
  '90d',
  '12m',
  'custom',
];

export class AnalyticsDateRangeDto {
  @IsOptional()
  @IsEnum(ANALYTICS_PERIODS, {
    message: `period must be one of: ${ANALYTICS_PERIODS.join(', ')}`,
  })
  period?: AnalyticsPeriod = '30d';

  @ValidateIf((o: AnalyticsDateRangeDto) => o.period === 'custom')
  @IsISO8601({}, { message: 'startDate must be a valid ISO 8601 date string' })
  startDate?: string;

  @ValidateIf((o: AnalyticsDateRangeDto) => o.period === 'custom')
  @IsISO8601({}, { message: 'endDate must be a valid ISO 8601 date string' })
  endDate?: string;
}
