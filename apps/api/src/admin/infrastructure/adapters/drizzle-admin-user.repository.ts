import { Inject, Injectable, Logger } from '@nestjs/common';
import { and, count, eq, sql } from 'drizzle-orm';

import { AdminUserRepositoryPort } from '../../application/ports/admin-user.repository.js';
import { AdminUser } from '../../domain/entities/admin-user.entity.js';
import { AdminId } from '../../domain/value-objects/admin-id.vo.js';
import { AdminEmail } from '../../domain/value-objects/admin-email.vo.js';
import { AdminRoleVO } from '../../domain/value-objects/admin-role.vo.js';
import { AdminPasswordHash } from '../../domain/value-objects/admin-password-hash.vo.js';
import {
  DRIZZLE,
  type DrizzleDB,
} from '../../../shared/infrastructure/database/postgres/drizzle.provider.js';
import {
  adminUsersSchema,
  type AdminUserSelectRow,
} from '../../../shared/infrastructure/database/postgres/schema/admin.schema.js';
import {
  ApplicationException,
  ApplicationExceptionCode,
} from '../../../shared/domain/exceptions/application.exception.js';

@Injectable()
export class DrizzleAdminUserRepository implements AdminUserRepositoryPort {
  private readonly logger = new Logger(DrizzleAdminUserRepository.name);

  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  async findById(id: AdminId): Promise<AdminUser | null> {
    const rows = await this.db
      .select()
      .from(adminUsersSchema)
      .where(eq(adminUsersSchema.id, id.value))
      .limit(1);

    if (rows.length === 0) return null;
    return this.mapToDomain(rows[0]);
  }

  async findByEmail(email: AdminEmail): Promise<AdminUser | null> {
    const rows = await this.db
      .select()
      .from(adminUsersSchema)
      .where(sql`lower(${adminUsersSchema.email}) = ${email.value}`)
      .limit(1);

    if (rows.length === 0) return null;
    return this.mapToDomain(rows[0]);
  }

  async countActiveSuperAdmins(): Promise<number> {
    const result = await this.db
      .select({ total: count() })
      .from(adminUsersSchema)
      .where(
        and(
          eq(adminUsersSchema.role, 'super-admin'),
          eq(adminUsersSchema.isActive, true),
        ),
      );

    return Number(result[0]?.total ?? 0);
  }

  async updateLastLogin(adminId: AdminId, ip: string | null): Promise<void> {
    const now = new Date();
    await this.db
      .update(adminUsersSchema)
      .set({
        lastLoginAt: now,
        lastLoginIp: ip,
        updatedAt: now,
      })
      .where(eq(adminUsersSchema.id, adminId.value));
  }

  async save(admin: AdminUser): Promise<void> {
    const existing = await this.db
      .select({ version: adminUsersSchema.version })
      .from(adminUsersSchema)
      .where(eq(adminUsersSchema.id, admin.id.value))
      .limit(1);

    if (existing.length === 0) {
      await this.db.insert(adminUsersSchema).values({
        id: admin.id.value,
        email: admin.email.value,
        passwordHash: admin.passwordHash.value,
        firstName: admin.firstName,
        lastName: admin.lastName,
        role: admin.role.value,
        phoneNumber: admin.phoneNumber,
        avatarUrl: admin.avatarUrl,
        isActive: admin.isActive,
        mustChangePassword: admin.mustChangePassword,
        version: admin.version,
        lastLoginAt: admin.lastLoginAt,
        lastLoginIp: admin.lastLoginIp,
        createdBy: admin.createdBy?.value ?? null,
        deactivatedAt: admin.deactivatedAt,
        deactivatedBy: admin.deactivatedBy?.value ?? null,
        deactivationReason: admin.deactivationReason,
        createdAt: admin.createdAt,
        updatedAt: admin.updatedAt,
      });
      return;
    }

    const currentDbVersion = existing[0].version;
    const currentDomainVersion = admin.version;
    const previousVersion = currentDomainVersion - 1;

    const result = await this.db
      .update(adminUsersSchema)
      .set({
        email: admin.email.value,
        passwordHash: admin.passwordHash.value,
        firstName: admin.firstName,
        lastName: admin.lastName,
        role: admin.role.value,
        phoneNumber: admin.phoneNumber,
        avatarUrl: admin.avatarUrl,
        isActive: admin.isActive,
        mustChangePassword: admin.mustChangePassword,
        version: currentDomainVersion,
        deactivatedAt: admin.deactivatedAt,
        deactivatedBy: admin.deactivatedBy?.value ?? null,
        deactivationReason: admin.deactivationReason,
        updatedAt: admin.updatedAt,
      })
      .where(
        and(
          eq(adminUsersSchema.id, admin.id.value),
          eq(adminUsersSchema.version, previousVersion),
        ),
      )
      .returning({ id: adminUsersSchema.id });

    if (result.length === 0) {
      throw new ApplicationException(
        `Conflict: AdminUser ${admin.id.value} was modified by another transaction (db version ${currentDbVersion}, expected ${previousVersion}).`,
        ApplicationExceptionCode.CONFLICT,
      );
    }
  }

  private mapToDomain(row: AdminUserSelectRow): AdminUser {
    return AdminUser.reconstitute({
      id: AdminId.create(row.id),
      email: AdminEmail.create(row.email),
      passwordHash: AdminPasswordHash.create(row.passwordHash),
      firstName: row.firstName,
      lastName: row.lastName,
      role: AdminRoleVO.create(row.role),
      phoneNumber: row.phoneNumber,
      avatarUrl: row.avatarUrl,
      isActive: row.isActive,
      mustChangePassword: row.mustChangePassword,
      version: row.version,
      lastLoginAt: row.lastLoginAt,
      lastLoginIp: row.lastLoginIp,
      createdBy: row.createdBy ? AdminId.create(row.createdBy) : null,
      deactivatedAt: row.deactivatedAt,
      deactivatedBy: row.deactivatedBy
        ? AdminId.create(row.deactivatedBy)
        : null,
      deactivationReason: row.deactivationReason,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    });
  }
}
