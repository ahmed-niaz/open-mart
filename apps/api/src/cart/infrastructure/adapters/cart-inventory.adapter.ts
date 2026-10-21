import { Inject, Injectable } from '@nestjs/common';
import { and, eq, inArray } from 'drizzle-orm';

import { CartInventoryPort } from '../../application/ports/cart-inventory.port.js';
import {
  DRIZZLE,
  type DrizzleDB,
} from '../../../shared/infrastructure/database/postgres/drizzle.provider.js';
import { inventoryItemsSchema } from '../../../shared/infrastructure/database/postgres/schema/inventory.schema.js';

@Injectable()
export class CartInventoryAdapter implements CartInventoryPort {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  async getAvailableStock(productId: string): Promise<number> {
    const rows = await this.db
      .select({
        quantityOnHand: inventoryItemsSchema.quantityOnHand,
        reservedQuantity: inventoryItemsSchema.reservedQuantity,
        isActive: inventoryItemsSchema.isActive,
      })
      .from(inventoryItemsSchema)
      .where(
        and(
          eq(inventoryItemsSchema.productId, productId),
          eq(inventoryItemsSchema.isActive, true),
        ),
      )
      .limit(1);

    if (rows.length === 0) {
      return 0;
    }

    const row = rows[0];
    return Math.max(0, row.quantityOnHand - row.reservedQuantity);
  }

  async getAvailableStocks(productIds: string[]): Promise<Map<string, number>> {
    const map = new Map<string, number>();
    if (productIds.length === 0) {
      return map;
    }

    const rows = await this.db
      .select({
        productId: inventoryItemsSchema.productId,
        quantityOnHand: inventoryItemsSchema.quantityOnHand,
        reservedQuantity: inventoryItemsSchema.reservedQuantity,
      })
      .from(inventoryItemsSchema)
      .where(
        and(
          inArray(inventoryItemsSchema.productId, productIds),
          eq(inventoryItemsSchema.isActive, true),
        ),
      );

    for (const row of rows) {
      map.set(
        row.productId,
        Math.max(0, row.quantityOnHand - row.reservedQuantity),
      );
    }

    return map;
  }
}
