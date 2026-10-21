import type { AnalyticsPeriod } from '../../../infrastructure/utils/analytics-date.helper.js';

export class GetCustomerInsightsQuery {
  constructor(
    public readonly period: AnalyticsPeriod = '30d',
    public readonly limit: number = 5,
    public readonly startDate?: string,
    public readonly endDate?: string,
    public readonly hasPiiPermission: boolean = false,
  ) {}
}
