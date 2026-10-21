export const CART_INVENTORY_PORT = Symbol('CART_INVENTORY_PORT');

export interface CartInventoryPort {
  getAvailableStock(productId: string): Promise<number>;
  getAvailableStocks(productIds: string[]): Promise<Map<string, number>>;
}
