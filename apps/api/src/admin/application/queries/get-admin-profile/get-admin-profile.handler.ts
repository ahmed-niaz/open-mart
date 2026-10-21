import { Inject } from '@nestjs/common';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { eq } from 'drizzle-orm';

import { GetAdminProfileQuery } from './get-admin-profile.query.js';
import {
  DRIZZLE,
  type DrizzleDB,
} from '../../../../shared/infrastructure/database/postgres/drizzle.provider.js';
import { adminUsersSchema } from '../../../../shared/infrastructure/database/postgres/schema/admin.schema.js';
import {
  ApplicationException,
  ApplicationExceptionCode,
} from '../../../../shared/domain/exceptions/application.exception.js';

export interface AdminProfileDto {
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
  createdAt: Date;
}

@QueryHandler(GetAdminProfileQuery)
export class GetAdminProfileQueryHandler implements IQueryHandler<
  GetAdminProfileQuery,
  AdminProfileDto
> {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  async execute(query: GetAdminProfileQuery): Promise<AdminProfileDto> {
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
        createdAt: adminUsersSchema.createdAt,
      })
      .from(adminUsersSchema)
      .where(eq(adminUsersSchema.id, query.adminId))
      .limit(1);

    if (rows.length === 0) {
      throw new ApplicationException(
        'Administrator profile not found.',
        ApplicationExceptionCode.NOT_FOUND,
      );
    }

    const admin = rows[0];

    return {
      id: admin.id,
      email: admin.email,
      firstName: admin.firstName,
      lastName: admin.lastName,
      fullName: `${admin.firstName} ${admin.lastName}`.trim(),
      role: admin.role,
      phoneNumber: admin.phoneNumber,
      avatarUrl: admin.avatarUrl,
      isActive: admin.isActive,
      mustChangePassword: admin.mustChangePassword,
      lastLoginAt: admin.lastLoginAt,
      createdAt: admin.createdAt,
    };
  }
}
