export const INVENTORY_RESERVATION_PORT = Symbol('INVENTORY_RESERVATION_PORT');

export type AvailabilityStatus = 'in_stock' | 'low_stock' | 'out_of_stock';

export interface ReserveStockItemInput {
  sku: string;
  quantity: number;
}

export interface InventoryReservationPort {
  reserveStock(
    orderId: string,
    items: ReserveStockItemInput[],
    ttlMinutes?: number,
  ): Promise<void>;

  checkAvailability(skus: string[]): Promise<Map<string, AvailabilityStatus>>;
}
