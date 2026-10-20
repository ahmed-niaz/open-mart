import { Inject, Injectable, Logger } from '@nestjs/common';
import { inArray, sql } from 'drizzle-orm';

import {
  AvailabilityStatus,
  InventoryReservationPort,
  ReserveStockItemInput,
} from '../../application/ports/inventory-reservation.port.js';
import { InsufficientStockException } from '../../domain/exceptions/insufficient-stock.exception.js';
import {
  DRIZZLE,
  type DrizzleDB,
} from '../../../shared/infrastructure/database/postgres/drizzle.provider.js';
import {
  inventoryItemsSchema,
  inventoryMovementsSchema,
  inventoryReservationsSchema,
} from '../../../shared/infrastructure/database/postgres/schema/inventory.schema.js';
import {
  ApplicationException,
  ApplicationExceptionCode,
} from '../../../shared/domain/exceptions/application.exception.js';

@Injectable()
export class InventoryReservationAdapter implements InventoryReservationPort {
  private readonly logger = new Logger(InventoryReservationAdapter.name);

  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  async reserveStock(
    orderId: string,
    items: ReserveStockItemInput[],
    ttlMinutes: number = 30,
  ): Promise<void> {
    if (!items || items.length === 0) {
      return;
    }

    // 1. Sort items by SKU lexicographically to guarantee global lock order (deadlock prevention)
    const sortedItems = [...items].sort((a, b) => a.sku.localeCompare(b.sku));

    const now = new Date();
    const expiresAt = new Date(now.getTime() + ttlMinutes * 60 * 1000);

    await this.db.transaction(async (tx) => {
      for (const item of sortedItems) {
        const normalizedSku = item.sku.trim().toUpperCase();

        if (item.quantity <= 0) {
          throw new ApplicationException(
            `Reservation quantity for SKU '${normalizedSku}' must be greater than 0`,
            ApplicationExceptionCode.VALIDATION_ERROR,
          );
        }

        // 2. Atomic conditional SQL update (Zero OCC retries on counters)
        const result = await tx.execute(sql`
          UPDATE inventory_items
          SET 
            reserved_quantity = reserved_quantity + ${item.quantity},
            updated_at = NOW()
          WHERE sku = ${normalizedSku} 
            AND is_active = true 
            AND (quantity_on_hand - reserved_quantity >= ${item.quantity})
          RETURNING id, quantity_on_hand, reserved_quantity;
        `);

        if ((result as any).length === 0) {
          // Determine reason for failure (not found, inactive, or insufficient)
          const checkResult = await tx.execute(sql`
            SELECT quantity_on_hand, reserved_quantity, is_active
            FROM inventory_items
            WHERE sku = ${normalizedSku};
          `);

          if (
            (checkResult as any).length === 0 ||
            !(checkResult as any)[0].is_active
          ) {
            throw new ApplicationException(
              `Item with SKU '${normalizedSku}' is not available for purchase`,
              ApplicationExceptionCode.NOT_FOUND,
            );
          }

          const row = (checkResult as any)[0];
          const onHand = Number(row.quantity_on_hand);
          const reserved = Number(row.reserved_quantity);
          const available = Math.max(0, onHand - reserved);

          throw new InsufficientStockException(
            normalizedSku,
            item.quantity,
            available,
          );
        }

        const row = (result as any)[0];
        const itemId = row.id as string;
        const newOnHand = Number(row.quantity_on_hand);
        const newReserved = Number(row.reserved_quantity);

        // 3. Insert reservation record (idempotency enforced by unique index)
        await tx.insert(inventoryReservationsSchema).values({
          orderId,
          inventoryItemId: itemId,
          sku: normalizedSku,
          quantity: item.quantity,
          status: 'reserved',
          expiresAt,
          createdAt: now,
          updatedAt: now,
        });

        // 4. Append movement ledger entry
        await tx.insert(inventoryMovementsSchema).values({
          inventoryItemId: itemId,
          sku: normalizedSku,
          reason: 'reservation_created',
          onHandDelta: 0,
          reservedDelta: item.quantity,
          onHandAfter: newOnHand,
          reservedAfter: newReserved,
          actorId: 'system',
          referenceType: 'order',
          referenceId: orderId,
          note: `Reserved ${item.quantity} units for order ${orderId} (Expires in ${ttlMinutes}m)`,
        });
      }
    });

    this.logger.log(
      `Successfully reserved stock for order '${orderId}' (${items.length} items, TTL: ${ttlMinutes}m)`,
    );
  }

  async checkAvailability(
    skus: string[],
  ): Promise<Map<string, AvailabilityStatus>> {
    const availabilityMap = new Map<string, AvailabilityStatus>();

    if (!skus || skus.length === 0) {
      return availabilityMap;
    }

    const normalizedSkus = skus.map((s) => s.trim().toUpperCase());

    const rows = await this.db
      .select({
        sku: inventoryItemsSchema.sku,
        quantityOnHand: inventoryItemsSchema.quantityOnHand,
        reservedQuantity: inventoryItemsSchema.reservedQuantity,
        lowStockThreshold: inventoryItemsSchema.lowStockThreshold,
        isActive: inventoryItemsSchema.isActive,
      })
      .from(inventoryItemsSchema)
      .where(inArray(inventoryItemsSchema.sku, normalizedSkus));

    const foundMap = new Map<string, (typeof rows)[0]>();
    for (const row of rows) {
      foundMap.set(row.sku, row);
    }

    for (const sku of normalizedSkus) {
      const item = foundMap.get(sku);
      if (!item || !item.isActive) {
        availabilityMap.set(sku, 'out_of_stock');
        continue;
      }

      const available = item.quantityOnHand - item.reservedQuantity;
      if (available <= 0) {
        availabilityMap.set(sku, 'out_of_stock');
      } else if (available <= item.lowStockThreshold) {
        availabilityMap.set(sku, 'low_stock');
      } else {
        availabilityMap.set(sku, 'in_stock');
      }
    }

    return availabilityMap;
  }
}
