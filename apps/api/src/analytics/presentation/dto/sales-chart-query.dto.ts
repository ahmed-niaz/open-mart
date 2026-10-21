import { IsEnum, IsOptional } from 'class-validator';
import { AnalyticsDateRangeDto } from './analytics-date-range.dto.js';
import type { ChartInterval } from '../../infrastructure/utils/analytics-date.helper.js';

export const CHART_INTERVALS: ChartInterval[] = [
  'hour',
  'day',
  'week',
  'month',
];

export class SalesChartQueryDto extends AnalyticsDateRangeDto {
  @IsOptional()
  @IsEnum(CHART_INTERVALS, {
    message: `interval must be one of: ${CHART_INTERVALS.join(', ')}`,
  })
  interval?: ChartInterval;
}
