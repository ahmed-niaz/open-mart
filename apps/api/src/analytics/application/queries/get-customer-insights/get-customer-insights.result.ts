export interface DistrictBreakdown {
  district: string;
  orderCount: number;
  totalAmount: number;
}

export interface DivisionBreakdown {
  division: string;
  orderCount: number;
  totalAmount: number;
  districts: DistrictBreakdown[];
}

export interface TopCustomerSpender {
  customerId: string;
  name: string;
  email: string | null;
  ordersCount: number;
  totalSpent: number;
}

export interface CustomerInsightsSummary {
  totalRegisteredCustomers: number;
  activePurchasersInPeriod: number;
  repeatPurchasersInPeriod: number;
  repeatCustomerRate: number | null;
  guestOrdersInPeriod: number;
}

export interface CustomerInsightsResult {
  currency: string;
  currencyUnit: string;
  period: {
    selected: string;
    from: string;
    to: string;
  };
  summary: CustomerInsightsSummary;
  geographicBreakdown: DivisionBreakdown[];
  topCustomers: TopCustomerSpender[];
}
