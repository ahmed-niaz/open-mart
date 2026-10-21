export interface SalesChartDataPoint {
  timestamp: string;
  label: string;
  grossRevenue: number;
  netRevenue: number;
  orderCount: number;
  unitsSold: number;
}

export interface SalesChartTotals {
  grossRevenue: number;
  netRevenue: number;
  totalOrders: number;
  totalUnitsSold: number;
}

export interface SalesChartResult {
  currency: string;
  currencyUnit: string;
  interval: string;
  timezone: string;
  series: SalesChartDataPoint[];
  totals: SalesChartTotals;
}
