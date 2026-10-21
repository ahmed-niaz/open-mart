import type { AnalyticsPeriod } from '../../../infrastructure/utils/analytics-date.helper.js';

export class GetOrderStatusStatsQuery {
  constructor(
    public readonly period: AnalyticsPeriod = '30d',
    public readonly startDate?: string,
    public readonly endDate?: string,
  ) {}
}
