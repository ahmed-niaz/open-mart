import { Inject, Injectable } from '@nestjs/common';
import { and, eq, isNull } from 'drizzle-orm';

import {
  AdminSessionRepositoryPort,
  AdminSessionRecord,
  CreateSessionDto,
} from '../../application/ports/admin-session.repository.js';
import {
  DRIZZLE,
  type DrizzleDB,
} from '../../../shared/infrastructure/database/postgres/drizzle.provider.js';
import { adminSessionsSchema } from '../../../shared/infrastructure/database/postgres/schema/admin-session.schema.js';

@Injectable()
export class DrizzleAdminSessionRepository implements AdminSessionRepositoryPort {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  async create(dto: CreateSessionDto): Promise<AdminSessionRecord> {
    const rows = await this.db
      .insert(adminSessionsSchema)
      .values({
        adminId: dto.adminId,
        tokenHash: dto.tokenHash,
        deviceInfo: dto.deviceInfo,
        ipAddress: dto.ipAddress,
        expiresAt: dto.expiresAt,
      })
      .returning();
    return rows[0] as AdminSessionRecord;
  }

  async findByTokenHash(hash: string): Promise<AdminSessionRecord | null> {
    const rows = await this.db
      .select()
      .from(adminSessionsSchema)
      .where(
        and(
          eq(adminSessionsSchema.tokenHash, hash),
          isNull(adminSessionsSchema.revokedAt),
        ),
      )
      .limit(1);
    if (rows.length === 0) return null;
    return rows[0] as AdminSessionRecord;
  }

  async revokeByTokenHash(hash: string): Promise<void> {
    await this.db
      .update(adminSessionsSchema)
      .set({ revokedAt: new Date() })
      .where(
        and(
          eq(adminSessionsSchema.tokenHash, hash),
          isNull(adminSessionsSchema.revokedAt),
        ),
      );
  }

  async revokeAllByAdminId(adminId: string): Promise<void> {
    await this.db
      .update(adminSessionsSchema)
      .set({ revokedAt: new Date() })
      .where(
        and(
          eq(adminSessionsSchema.adminId, adminId),
          isNull(adminSessionsSchema.revokedAt),
        ),
      );
  }
}
