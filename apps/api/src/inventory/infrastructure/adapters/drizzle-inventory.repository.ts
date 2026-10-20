import { Inject, Injectable, Logger } from '@nestjs/common';
import { eq, sql } from 'drizzle-orm';

import { InventoryRepositoryPort } from '../../application/ports/inventory.repository.js';
import { InventoryItem } from '../../domain/entities/inventory-item.entity.js';
import { Sku } from '../../domain/value-objects/sku.vo.js';
import { StockLevel } from '../../domain/value-objects/stock-level.vo.js';
import {
  DRIZZLE,
  type DrizzleDB,
} from '../../../shared/infrastructure/database/postgres/drizzle.provider.js';
import {
  inventoryItemsSchema,
  inventoryMovementsSchema,
} from '../../../shared/infrastructure/database/postgres/schema/inventory.schema.js';
import {
  ApplicationException,
  ApplicationExceptionCode,
} from '../../../shared/domain/exceptions/application.exception.js';

@Injectable()
export class DrizzleInventoryRepository implements InventoryRepositoryPort {
  private readonly logger = new Logger(DrizzleInventoryRepository.name);

  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  async findBySku(sku: string): Promise<InventoryItem | null> {
    const normalizedSku = sku.trim().toUpperCase();
    const rows = await this.db
      .select()
      .from(inventoryItemsSchema)
      .where(eq(inventoryItemsSchema.sku, normalizedSku))
      .limit(1);

    if (rows.length === 0) return null;
    return this.mapToDomain(rows[0]);
  }

  async findByProductId(productId: string): Promise<InventoryItem | null> {
    const rows = await this.db
      .select()
      .from(inventoryItemsSchema)
      .where(eq(inventoryItemsSchema.productId, productId))
      .limit(1);

    if (rows.length === 0) return null;
    return this.mapToDomain(rows[0]);
  }

  async save(item: InventoryItem): Promise<void> {
    const existing = await this.db
      .select()
      .from(inventoryItemsSchema)
      .where(eq(inventoryItemsSchema.id, item.id))
      .limit(1);

    if (existing.length === 0) {
      // Insert new inventory item
      await this.db.insert(inventoryItemsSchema).values({
        id: item.id,
        productId: item.productId,
        sku: item.sku.getValue(),
        quantityOnHand: item.stockLevel.getOnHand().getValue(),
        reservedQuantity: item.stockLevel.getReserved().getValue(),
        lowStockThreshold: item.lowStockThreshold,
        isActive: item.isActive,
        version: item.version,
        createdAt: item.createdAt,
        updatedAt: item.updatedAt,
      });
      return;
    }

    // Atomic OCC update for administrative settings
    const currentVersion = item.version;
    item.incrementVersion();

    const result = await this.db
      .update(inventoryItemsSchema)
      .set({
        lowStockThreshold: item.lowStockThreshold,
        isActive: item.isActive,
        version: item.version,
        updatedAt: item.updatedAt,
      })
      .where(
        sql`${inventoryItemsSchema.id} = ${item.id} AND ${inventoryItemsSchema.version} = ${currentVersion}`,
      )
      .returning({ id: inventoryItemsSchema.id });

    if (result.length === 0) {
      throw new ApplicationException(
        `Optimistic concurrency conflict on inventory item '${item.sku.getValue()}'. Please reload and retry.`,
        ApplicationExceptionCode.CONFLICT,
      );
    }
  }

  async atomicRestock(
    sku: string,
    quantity: number,
    actorId?: string | null,
    note?: string | null,
  ): Promise<{ newOnHand: number }> {
    const normalizedSku = sku.trim().toUpperCase();

    return await this.db.transaction(async (tx) => {
      const result = await tx.execute(sql`
        UPDATE inventory_items
        SET 
          quantity_on_hand = quantity_on_hand + ${quantity},
          updated_at = NOW()
        WHERE sku = ${normalizedSku} AND is_active = true
        RETURNING id, quantity_on_hand, reserved_quantity;
      `);

      if ((result as any).length === 0) {
        throw new ApplicationException(
          `Inventory item with SKU '${normalizedSku}' not found or is inactive`,
          ApplicationExceptionCode.NOT_FOUND,
        );
      }

      const row = (result as any)[0];
      const newOnHand = Number(row.quantity_on_hand);
      const reserved = Number(row.reserved_quantity);

      await tx.insert(inventoryMovementsSchema).values({
        inventoryItemId: row.id as string,
        sku: normalizedSku,
        reason: 'restock',
        onHandDelta: quantity,
        reservedDelta: 0,
        onHandAfter: newOnHand,
        reservedAfter: reserved,
        actorId: actorId ?? null,
        referenceType: 'purchase_order',
        referenceId: `restock-${Date.now()}`,
        note: note ?? 'Warehouse inbound restock',
      });

      return { newOnHand };
    });
  }

  async atomicAdjust(
    sku: string,
    delta: number,
    reason: string,
    actorId?: string | null,
    note?: string | null,
  ): Promise<{ newOnHand: number }> {
    const normalizedSku = sku.trim().toUpperCase();

    return await this.db.transaction(async (tx) => {
      const result = await tx.execute(sql`
        UPDATE inventory_items
        SET 
          quantity_on_hand = quantity_on_hand + ${delta},
          updated_at = NOW()
        WHERE sku = ${normalizedSku} 
          AND is_active = true
          AND (quantity_on_hand + ${delta} >= reserved_quantity)
          AND (quantity_on_hand + ${delta} >= 0)
        RETURNING id, quantity_on_hand, reserved_quantity;
      `);

      if ((result as any).length === 0) {
        throw new ApplicationException(
          `Cannot adjust SKU '${normalizedSku}': adjustment of ${delta} would violate non-negative or reserved stock constraints`,
          ApplicationExceptionCode.VALIDATION_ERROR,
        );
      }

      const row = (result as any)[0];
      const newOnHand = Number(row.quantity_on_hand);
      const reserved = Number(row.reserved_quantity);

      await tx.insert(inventoryMovementsSchema).values({
        inventoryItemId: row.id as string,
        sku: normalizedSku,
        reason: (reason === 'loss' ? 'loss' : 'damaged') as any,
        onHandDelta: delta,
        reservedDelta: 0,
        onHandAfter: newOnHand,
        reservedAfter: reserved,
        actorId: actorId ?? null,
        referenceType: 'manual',
        referenceId: `adjust-${Date.now()}`,
        note: note ?? `Manual stock adjustment (${reason})`,
      });

      return { newOnHand };
    });
  }

  async atomicStocktake(
    sku: string,
    countedQuantity: number,
    actorId?: string | null,
    note?: string | null,
  ): Promise<{ delta: number; newOnHand: number }> {
    const normalizedSku = sku.trim().toUpperCase();

    return await this.db.transaction(async (tx) => {
      // 1. Fetch current item
      const currentResult = await tx.execute(sql`
        SELECT id, quantity_on_hand, reserved_quantity
        FROM inventory_items
        WHERE sku = ${normalizedSku} AND is_active = true
        FOR UPDATE;
      `);

      if ((currentResult as any).length === 0) {
        throw new ApplicationException(
          `Inventory item with SKU '${normalizedSku}' not found or is inactive`,
          ApplicationExceptionCode.NOT_FOUND,
        );
      }

      const current = (currentResult as any)[0];
      const currentOnHand = Number(current.quantity_on_hand);
      const reserved = Number(current.reserved_quantity);

      if (countedQuantity < reserved) {
        throw new ApplicationException(
          `Counted physical stock (${countedQuantity}) cannot be less than current active reservations (${reserved})`,
          ApplicationExceptionCode.VALIDATION_ERROR,
        );
      }

      const delta = countedQuantity - currentOnHand;

      await tx.execute(sql`
        UPDATE inventory_items
        SET quantity_on_hand = ${countedQuantity}, updated_at = NOW()
        WHERE id = ${current.id};
      `);

      await tx.insert(inventoryMovementsSchema).values({
        inventoryItemId: current.id as string,
        sku: normalizedSku,
        reason: 'stocktake_adjustment',
        onHandDelta: delta,
        reservedDelta: 0,
        onHandAfter: countedQuantity,
        reservedAfter: reserved,
        actorId: actorId ?? null,
        referenceType: 'stocktake',
        referenceId: `stocktake-${Date.now()}`,
        note:
          note ??
          `Physical warehouse stocktake recount (delta: ${delta > 0 ? `+${delta}` : delta})`,
      });

      return { delta, newOnHand: countedQuantity };
    });
  }

  private mapToDomain(row: any): InventoryItem {
    return InventoryItem.reconstitute({
      id: row.id,
      productId: row.productId,
      sku: Sku.create(row.sku),
      stockLevel: StockLevel.create(row.quantityOnHand, row.reservedQuantity),
      lowStockThreshold: row.lowStockThreshold,
      isActive: row.isActive,
      version: row.version,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    });
  }
}
