import { Inject } from '@nestjs/common';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { eq } from 'drizzle-orm';

import { GetAdminUserByIdQuery } from './get-admin-user-by-id.query.js';
import {
  DRIZZLE,
  type DrizzleDB,
} from '../../../../shared/infrastructure/database/postgres/drizzle.provider.js';
import { adminUsersSchema } from '../../../../shared/infrastructure/database/postgres/schema/admin.schema.js';
import {
  ApplicationException,
  ApplicationExceptionCode,
} from '../../../../shared/domain/exceptions/application.exception.js';

export interface AdminUserDetailDto {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  fullName: string;
  role: string;
  phoneNumber: string | null;
  avatarUrl: string | null;
  isActive: boolean;
  mustChangePassword: boolean;
  lastLoginAt: Date | null;
  lastLoginIp: string | null;
  createdBy: string | null;
  deactivatedAt: Date | null;
  deactivatedBy: string | null;
  deactivationReason: string | null;
  createdAt: Date;
  updatedAt: Date;
}

@QueryHandler(GetAdminUserByIdQuery)
export class GetAdminUserByIdQueryHandler implements IQueryHandler<
  GetAdminUserByIdQuery,
  AdminUserDetailDto
> {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  async execute(query: GetAdminUserByIdQuery): Promise<AdminUserDetailDto> {
    const rows = await this.db
      .select({
        id: adminUsersSchema.id,
        email: adminUsersSchema.email,
        firstName: adminUsersSchema.firstName,
        lastName: adminUsersSchema.lastName,
        role: adminUsersSchema.role,
        phoneNumber: adminUsersSchema.phoneNumber,
        avatarUrl: adminUsersSchema.avatarUrl,
        isActive: adminUsersSchema.isActive,
        mustChangePassword: adminUsersSchema.mustChangePassword,
        lastLoginAt: adminUsersSchema.lastLoginAt,
        lastLoginIp: adminUsersSchema.lastLoginIp,
        createdBy: adminUsersSchema.createdBy,
        deactivatedAt: adminUsersSchema.deactivatedAt,
        deactivatedBy: adminUsersSchema.deactivatedBy,
        deactivationReason: adminUsersSchema.deactivationReason,
        createdAt: adminUsersSchema.createdAt,
        updatedAt: adminUsersSchema.updatedAt,
      })
      .from(adminUsersSchema)
      .where(eq(adminUsersSchema.id, query.adminId))
      .limit(1);

    if (rows.length === 0) {
      throw new ApplicationException(
        'Administrator not found.',
        ApplicationExceptionCode.NOT_FOUND,
      );
    }

    const row = rows[0];

    return {
      id: row.id,
      email: row.email,
      firstName: row.firstName,
      lastName: row.lastName,
      fullName: `${row.firstName} ${row.lastName}`.trim(),
      role: row.role,
      phoneNumber: row.phoneNumber,
      avatarUrl: row.avatarUrl,
      isActive: row.isActive,
      mustChangePassword: row.mustChangePassword,
      lastLoginAt: row.lastLoginAt,
      lastLoginIp: row.lastLoginIp,
      createdBy: row.createdBy,
      deactivatedAt: row.deactivatedAt,
      deactivatedBy: row.deactivatedBy,
      deactivationReason: row.deactivationReason,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }
}
