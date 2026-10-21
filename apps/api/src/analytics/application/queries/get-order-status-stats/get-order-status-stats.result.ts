import type { OrderStatusValue } from '../../../../shared/infrastructure/database/postgres/schema/order.schema.js';

export interface OrderStatusBreakdownItem {
  status: OrderStatusValue;
  count: number;
  totalAmount: number;
  percentage: number;
}

export interface OrderStatusKpis {
  totalOrders: number;
  matureCohortFulfillmentRate: number | null;
  cancellationRate: number;
  returnRate: number;
  cancelledInPeriodCount: number;
  returnedInPeriodCount: number;
}

export interface OrderStatusStatsResult {
  period: {
    selected: string;
    from: string;
    to: string;
  };
  statuses: OrderStatusBreakdownItem[];
  kpis: OrderStatusKpis;
}
