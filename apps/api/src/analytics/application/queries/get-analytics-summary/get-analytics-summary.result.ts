export interface PeriodFinancialMetrics {
  grossRevenue: number | null;
  netRevenue: number | null;
  totalOrders: number;
  averageOrderValue: number | null;
  totalUnitsSold: number;
  newCustomers: number;
}

export interface MetricDeltas {
  revenuePercentage: number | null;
  ordersPercentage: number | null;
  aovPercentage: number | null;
  customersPercentage: number | null;
}

export interface OperationalAlerts {
  pendingOrdersCount: number;
  processingOrdersCount: number;
  lowStockCount: number;
  outOfStockCount: number;
  paymentReviewCount: number;
}

export interface AnalyticsSummaryResult {
  currency: string;
  currencyUnit: string;
  period: {
    selected: string;
    from: string;
    to: string;
    comparisonFrom: string;
    comparisonTo: string;
  };
  currentPeriod: PeriodFinancialMetrics;
  previousPeriod: PeriodFinancialMetrics;
  delta: MetricDeltas;
  operationalAlerts: OperationalAlerts;
}
