export interface LowStockAlertItem {
  id: string;
  productId: string;
  productName: string;
  sku: string;
  quantityOnHand: number;
  reservedQuantity: number;
  availableQuantity: number;
  lowStockThreshold: number;
  thumbnailUrl: string | null;
}

export interface InventoryHealthSummary {
  totalSkus: number;
  inStockSkus: number;
  lowStockSkus: number;
  outOfStockSkus: number;
  totalUnitsOnHand: number;
  totalUnitsReserved: number;
  estimatedRetailValue: number; // in cents/poisha
}

export interface InventoryHealthResult {
  currency: string;
  currencyUnit: string;
  summary: InventoryHealthSummary;
  lowStockAlerts: LowStockAlertItem[];
}
