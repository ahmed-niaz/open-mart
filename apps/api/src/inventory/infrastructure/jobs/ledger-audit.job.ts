import { Inject, Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { sql } from 'drizzle-orm';

import {
  DRIZZLE,
  type DrizzleDB,
} from '../../../shared/infrastructure/database/postgres/drizzle.provider.js';

@Injectable()
export class LedgerAuditJob {
  private readonly logger = new Logger(LedgerAuditJob.name);

  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  // Runs daily at 00:00 (Midnight)
  @Cron('0 0 * * *')
  async verifyLedgerIntegrity(): Promise<void> {
    this.logger.log('Starting nightly inventory ledger integrity audit...');

    try {
      const result = await this.db.execute(sql`
        SELECT 
          i.sku,
          i.quantity_on_hand,
          COALESCE(SUM(m.on_hand_delta), 0) AS calculated_on_hand
        FROM inventory_items i
        LEFT JOIN inventory_movements m ON i.id = m.inventory_item_id
        GROUP BY i.id, i.sku, i.quantity_on_hand
        HAVING i.quantity_on_hand != COALESCE(SUM(m.on_hand_delta), 0);
      `);

      if ((result as any).length === 0) {
        this.logger.log(
          'Nightly inventory audit complete: 100% ledger integrity verified! All SKU totals match movement logs.',
        );
        return;
      }

      this.logger.error(
        `AUDIT DISCREPANCY DETECTED: ${(result as any).length} SKU(s) do not match ledger sum!`,
      );

      for (const raw of result as any) {
        const row = raw as any;
        this.logger.error(
          `DISCREPANCY: SKU '${row.sku}' has quantity_on_hand=${row.quantity_on_hand}, but sum(movements)=${row.calculated_on_hand}`,
        );
      }
    } catch (err: any) {
      this.logger.error(
        `Error during verifyLedgerIntegrity audit: ${err.message}`,
        err.stack,
      );
    }
  }
}
