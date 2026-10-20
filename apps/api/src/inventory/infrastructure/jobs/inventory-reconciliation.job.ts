import { Inject, Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { CommandBus } from '@nestjs/cqrs';
import { sql } from 'drizzle-orm';

import {
  DRIZZLE,
  type DrizzleDB,
} from '../../../shared/infrastructure/database/postgres/drizzle.provider.js';
import { CommitStockCommand } from '../../application/commands/commit-stock/commit-stock.command.js';

@Injectable()
export class InventoryReconciliationJob {
  private readonly logger = new Logger(InventoryReconciliationJob.name);

  constructor(
    @Inject(DRIZZLE) private readonly db: DrizzleDB,
    private readonly commandBus: CommandBus,
  ) {}

  // Runs every 10 minutes to heal any crashed/missed commits
  @Cron('*/10 * * * *')
  async reconcileUncommittedOrders(): Promise<void> {
    try {
      // Find orders that are confirmed in orders table, but still have 'reserved' stock
      const result = await this.db.execute(sql`
        SELECT DISTINCT o.id AS order_id
        FROM orders o
        JOIN inventory_reservations r ON o.id = r.order_id
        WHERE o.status = 'confirmed' AND r.status = 'reserved'
        LIMIT 50;
      `);

      if ((result as any).length === 0) {
        return;
      }

      this.logger.log(
        `Reconciliation found ${(result as any).length} confirmed order(s) with uncommitted reservations. Healing...`,
      );

      for (const row of result as any) {
        const orderId = (row as any).order_id as string;
        try {
          await this.commandBus.execute(new CommitStockCommand(orderId));
        } catch (err: any) {
          this.logger.error(
            `Failed to heal uncommitted stock for order '${orderId}': ${err.message}`,
          );
        }
      }
    } catch (err: any) {
      this.logger.error(
        `Error during reconcileUncommittedOrders job: ${err.message}`,
        err.stack,
      );
    }
  }
}
