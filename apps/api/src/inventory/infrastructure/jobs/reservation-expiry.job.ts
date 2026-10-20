import { Inject, Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { EventBus } from '@nestjs/cqrs';
import { sql } from 'drizzle-orm';

import {
  DRIZZLE,
  type DrizzleDB,
} from '../../../shared/infrastructure/database/postgres/drizzle.provider.js';
import { ReservationExpiredEvent } from '../../domain/events/reservation-expired.event.js';

@Injectable()
export class ReservationExpiryJob {
  private readonly logger = new Logger(ReservationExpiryJob.name);

  constructor(
    @Inject(DRIZZLE) private readonly db: DrizzleDB,
    private readonly eventBus: EventBus,
  ) {}

  // Runs every 2 minutes
  @Cron('*/2 * * * *')
  async sweepExpiredReservations(): Promise<void> {
    try {
      await this.db.transaction(async (tx) => {
        // Multi-instance concurrency safety: SKIP LOCKED prevents race conditions across instances
        const expired = await tx.execute(sql`
          SELECT r.id, r.order_id, r.inventory_item_id, r.sku, r.quantity
          FROM inventory_reservations r
          WHERE r.status = 'reserved' AND r.expires_at < NOW()
          ORDER BY r.sku ASC
          FOR UPDATE SKIP LOCKED
          LIMIT 100;
        `);

        if ((expired as any).length === 0) {
          return;
        }

        this.logger.log(
          `Found ${(expired as any).length} expired stock reservation(s). Releasing...`,
        );

        for (const raw of expired as any) {
          const row = raw as any;
          const reservationId = row.id as string;
          const orderId = row.order_id as string;
          const itemId = row.inventory_item_id as string;
          const sku = row.sku as string;
          const quantity = Number(row.quantity);

          // 1. Mark reservation expired
          await tx.execute(sql`
            UPDATE inventory_reservations 
            SET status = 'expired', updated_at = NOW() 
            WHERE id = ${reservationId};
          `);

          // 2. Decrement reserved_quantity atomically
          const updatedItem = await tx.execute(sql`
            UPDATE inventory_items 
            SET reserved_quantity = reserved_quantity - ${quantity}, updated_at = NOW()
            WHERE id = ${itemId}
            RETURNING quantity_on_hand, reserved_quantity;
          `);

          const itemRow = (updatedItem as any)[0];
          const onHand = Number(itemRow.quantity_on_hand);
          const reserved = Number(itemRow.reserved_quantity);

          // 3. Append to movement ledger
          await tx.execute(sql`
            INSERT INTO inventory_movements (
              inventory_item_id, sku, reason, on_hand_delta, reserved_delta,
              on_hand_after, reserved_after, actor_id, reference_type, reference_id, note
            ) VALUES (
              ${itemId}, ${sku}, 'reservation_expired', 0, -${quantity},
              ${onHand}, ${reserved}, 'system_cron', 'order', ${orderId}, 'Stock reservation expired'
            );
          `);

          // 4. Notify Order module to cancel the abandoned pending order
          this.eventBus.publish(
            new ReservationExpiredEvent(orderId, sku, quantity, new Date()),
          );
        }
      });
    } catch (err: any) {
      this.logger.error(
        `Error during sweepExpiredReservations job: ${err.message}`,
        err.stack,
      );
    }
  }
}
