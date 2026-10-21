import { Inject, Injectable, Logger } from '@nestjs/common';

import {
  type AdminAuditPort,
  type AuditLogEntry,
} from '../../application/ports/admin-audit.port.js';
import {
  DRIZZLE,
  type DrizzleDB,
} from '../../../shared/infrastructure/database/postgres/drizzle.provider.js';
import { adminAuditLogsSchema } from '../../../shared/infrastructure/database/postgres/schema/admin.schema.js';

@Injectable()
export class DrizzleAdminAuditAdapter implements AdminAuditPort {
  private readonly logger = new Logger(DrizzleAdminAuditAdapter.name);

  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  async recordLog(entry: AuditLogEntry): Promise<void> {
    try {
      await this.db.insert(adminAuditLogsSchema).values({
        adminId: entry.adminId,
        action: entry.action,
        targetId: entry.targetId ?? null,
        details: entry.details ?? null,
        ipAddress: entry.ipAddress ?? null,
        userAgent: entry.userAgent ?? null,
      });
    } catch (error) {
      // Audit log recording must never crash the main transaction
      this.logger.error(
        `Failed to record admin audit log for admin '${entry.adminId}', action '${entry.action}':`,
        error,
      );
    }
  }
}
