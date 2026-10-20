import { Inject, Injectable, Logger } from '@nestjs/common';
import { eq, sql } from 'drizzle-orm';

import { ReservationRepositoryPort } from '../../application/ports/reservation.repository.js';
import { Reservation } from '../../domain/entities/reservation.entity.js';
import { Sku } from '../../domain/value-objects/sku.vo.js';
import { Quantity } from '../../domain/value-objects/quantity.vo.js';
import {
  DRIZZLE,
  type DrizzleDB,
} from '../../../shared/infrastructure/database/postgres/drizzle.provider.js';
import {
  inventoryMovementsSchema,
  inventoryReservationsSchema,
} from '../../../shared/infrastructure/database/postgres/schema/inventory.schema.js';

@Injectable()
export class DrizzleReservationRepository implements ReservationRepositoryPort {
  private readonly logger = new Logger(DrizzleReservationRepository.name);

  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  async findByOrderId(orderId: string): Promise<Reservation[]> {
    const rows = await this.db
      .select()
      .from(inventoryReservationsSchema)
      .where(eq(inventoryReservationsSchema.orderId, orderId));

    return rows.map((r) => this.mapToDomain(r));
  }

  async save(reservation: Reservation): Promise<void> {
    const existing = await this.db
      .select()
      .from(inventoryReservationsSchema)
      .where(eq(inventoryReservationsSchema.id, reservation.id))
      .limit(1);

    if (existing.length === 0) {
      await this.db.insert(inventoryReservationsSchema).values({
        id: reservation.id,
        orderId: reservation.orderId,
        inventoryItemId: reservation.inventoryItemId,
        sku: reservation.sku.getValue(),
        quantity: reservation.quantity.getValue(),
        status: reservation.status,
        expiresAt: reservation.expiresAt,
        createdAt: reservation.createdAt,
        updatedAt: reservation.updatedAt,
      });
      return;
    }

    await this.db
      .update(inventoryReservationsSchema)
      .set({
        status: reservation.status,
        updatedAt: reservation.updatedAt,
      })
      .where(eq(inventoryReservationsSchema.id, reservation.id));
  }

  async commitForOrder(
    orderId: string,
  ): Promise<Array<{ sku: string; quantity: number; newOnHand: number }>> {
    return await this.db.transaction(async (tx) => {
      // 1. Fetch active reservations with lock
      const reservations = await tx
        .select()
        .from(inventoryReservationsSchema)
        .where(
          sql`${inventoryReservationsSchema.orderId} = ${orderId} AND ${inventoryReservationsSchema.status} = 'reserved'`,
        );

      if (reservations.length === 0) {
        this.logger.warn(
          `No active reservations found to commit for order '${orderId}' (may be already committed or expired)`,
        );
        return [];
      }

      const results: Array<{
        sku: string;
        quantity: number;
        newOnHand: number;
      }> = [];

      for (const res of reservations) {
        // Update reservation status to committed
        await tx
          .update(inventoryReservationsSchema)
          .set({
            status: 'committed',
            updatedAt: new Date(),
          })
          .where(
            sql`${inventoryReservationsSchema.id} = ${res.id} AND ${inventoryReservationsSchema.status} = 'reserved'`,
          );

        // Deduct both on_hand and reserved quantity atomically
        const itemResult = await tx.execute(sql`
          UPDATE inventory_items
          SET 
            quantity_on_hand = quantity_on_hand - ${res.quantity},
            reserved_quantity = reserved_quantity - ${res.quantity},
            updated_at = NOW()
          WHERE id = ${res.inventoryItemId}
          RETURNING quantity_on_hand, reserved_quantity;
        `);

        const row = (itemResult as any)[0];
        const newOnHand = Number(row.quantity_on_hand);
        const reserved = Number(row.reserved_quantity);

        // Record immutable ledger movement
        await tx.insert(inventoryMovementsSchema).values({
          inventoryItemId: res.inventoryItemId,
          sku: res.sku,
          reason: 'reservation_committed',
          onHandDelta: -res.quantity,
          reservedDelta: -res.quantity,
          onHandAfter: newOnHand,
          reservedAfter: reserved,
          actorId: 'system',
          referenceType: 'order',
          referenceId: orderId,
          note: `Stock committed for confirmed order ${orderId}`,
        });

        results.push({
          sku: res.sku,
          quantity: res.quantity,
          newOnHand,
        });
      }

      return results;
    });
  }

  async releaseForOrder(
    orderId: string,
    reason: string = 'Order cancelled before confirmation',
  ): Promise<Array<{ sku: string; quantity: number }>> {
    return await this.db.transaction(async (tx) => {
      const reservations = await tx
        .select()
        .from(inventoryReservationsSchema)
        .where(
          sql`${inventoryReservationsSchema.orderId} = ${orderId} AND ${inventoryReservationsSchema.status} = 'reserved'`,
        );

      if (reservations.length === 0) {
        return [];
      }

      const results: Array<{ sku: string; quantity: number }> = [];

      for (const res of reservations) {
        await tx
          .update(inventoryReservationsSchema)
          .set({
            status: 'released',
            updatedAt: new Date(),
          })
          .where(
            sql`${inventoryReservationsSchema.id} = ${res.id} AND ${inventoryReservationsSchema.status} = 'reserved'`,
          );

        const itemResult = await tx.execute(sql`
          UPDATE inventory_items
          SET 
            reserved_quantity = reserved_quantity - ${res.quantity},
            updated_at = NOW()
          WHERE id = ${res.inventoryItemId}
          RETURNING quantity_on_hand, reserved_quantity;
        `);

        const row = (itemResult as any)[0];
        const newOnHand = Number(row.quantity_on_hand);
        const reserved = Number(row.reserved_quantity);

        await tx.insert(inventoryMovementsSchema).values({
          inventoryItemId: res.inventoryItemId,
          sku: res.sku,
          reason: 'reservation_released',
          onHandDelta: 0,
          reservedDelta: -res.quantity,
          onHandAfter: newOnHand,
          reservedAfter: reserved,
          actorId: 'system',
          referenceType: 'order',
          referenceId: orderId,
          note: reason,
        });

        results.push({ sku: res.sku, quantity: res.quantity });
      }

      return results;
    });
  }

  async reverseForOrder(
    orderId: string,
    reason: string = 'Order cancelled after confirmation',
  ): Promise<Array<{ sku: string; quantity: number; newOnHand: number }>> {
    return await this.db.transaction(async (tx) => {
      const reservations = await tx
        .select()
        .from(inventoryReservationsSchema)
        .where(
          sql`${inventoryReservationsSchema.orderId} = ${orderId} AND ${inventoryReservationsSchema.status} = 'committed'`,
        );

      if (reservations.length === 0) {
        return [];
      }

      const results: Array<{
        sku: string;
        quantity: number;
        newOnHand: number;
      }> = [];

      for (const res of reservations) {
        await tx
          .update(inventoryReservationsSchema)
          .set({
            status: 'reversed',
            updatedAt: new Date(),
          })
          .where(
            sql`${inventoryReservationsSchema.id} = ${res.id} AND ${inventoryReservationsSchema.status} = 'committed'`,
          );

        const itemResult = await tx.execute(sql`
          UPDATE inventory_items
          SET 
            quantity_on_hand = quantity_on_hand + ${res.quantity},
            updated_at = NOW()
          WHERE id = ${res.inventoryItemId}
          RETURNING quantity_on_hand, reserved_quantity;
        `);

        const row = (itemResult as any)[0];
        const newOnHand = Number(row.quantity_on_hand);
        const reserved = Number(row.reserved_quantity);

        await tx.insert(inventoryMovementsSchema).values({
          inventoryItemId: res.inventoryItemId,
          sku: res.sku,
          reason: 'cancellation_restock',
          onHandDelta: res.quantity,
          reservedDelta: 0,
          onHandAfter: newOnHand,
          reservedAfter: reserved,
          actorId: 'system',
          referenceType: 'order',
          referenceId: orderId,
          note: reason,
        });

        results.push({
          sku: res.sku,
          quantity: res.quantity,
          newOnHand,
        });
      }

      return results;
    });
  }

  private mapToDomain(row: any): Reservation {
    return Reservation.reconstitute({
      id: row.id,
      orderId: row.orderId,
      inventoryItemId: row.inventoryItemId,
      sku: Sku.create(row.sku),
      quantity: Quantity.create(row.quantity),
      status: row.status,
      expiresAt: row.expiresAt,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    });
  }
}
