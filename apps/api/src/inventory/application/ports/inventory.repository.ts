import { InventoryItem } from '../../domain/entities/inventory-item.entity.js';

export const INVENTORY_REPOSITORY = Symbol('INVENTORY_REPOSITORY');

export interface InventoryRepositoryPort {
  findBySku(sku: string): Promise<InventoryItem | null>;
  findByProductId(productId: string): Promise<InventoryItem | null>;
  save(item: InventoryItem): Promise<void>;
  atomicRestock(
    sku: string,
    quantity: number,
    actorId?: string | null,
    note?: string | null,
  ): Promise<{ newOnHand: number }>;
  atomicAdjust(
    sku: string,
    delta: number,
    reason: string,
    actorId?: string | null,
    note?: string | null,
  ): Promise<{ newOnHand: number }>;
  atomicStocktake(
    sku: string,
    countedQuantity: number,
    actorId?: string | null,
    note?: string | null,
  ): Promise<{ delta: number; newOnHand: number }>;
}
