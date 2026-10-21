export interface TopProductItem {
  productId: string | null;
  productName: string;
  sku: string;
  unitsSold: number;
  grossItemRevenue: number | null; // Cents/poisha. Documented as item revenue before order discounts
  currentStockOnHand: number | null;
  thumbnailUrl: string | null;
}

export interface TopProductsResult {
  currency: string;
  currencyUnit: string;
  period: {
    selected: string;
    from: string;
    to: string;
  };
  sortBy: 'revenue' | 'units';
  items: TopProductItem[];
}
