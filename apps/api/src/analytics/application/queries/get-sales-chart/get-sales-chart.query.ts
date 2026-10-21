import type {
  AnalyticsPeriod,
  ChartInterval,
} from '../../../infrastructure/utils/analytics-date.helper.js';

export class GetSalesChartQuery {
  constructor(
    public readonly period: AnalyticsPeriod = '30d',
    public readonly interval?: ChartInterval,
    public readonly startDate?: string,
    public readonly endDate?: string,
  ) {}
}
