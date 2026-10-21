import { ExecutionContext, Inject, Injectable, Logger } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import type { Request } from 'express';

import {
  TOKEN_SERVICE_PORT,
  type TokenServicePort,
} from '../../application/ports/token-service.port.js';
import { BaseJwtAuthGuard } from './base-jwt-auth.guard.js';
import {
  ApplicationException,
  ApplicationExceptionCode,
} from '../../domain/exceptions/application.exception.js';
import {
  DRIZZLE,
  type DrizzleDB,
} from '../database/postgres/drizzle.provider.js';
import { adminUsersSchema } from '../database/postgres/schema/admin.schema.js';

@Injectable()
export class AdminJwtGuard extends BaseJwtAuthGuard {
  private readonly logger = new Logger(AdminJwtGuard.name);

  constructor(
    @Inject(TOKEN_SERVICE_PORT)
    tokenService: TokenServicePort,
    @Inject(DRIZZLE)
    private readonly db: DrizzleDB,
  ) {
    super(tokenService);
  }

  getExpectedScope(): 'customer' | 'admin' {
    return 'admin';
  }

  override async canActivate(context: ExecutionContext): Promise<boolean> {
    const parentAllowed = await super.canActivate(context);
    if (!parentAllowed) {
      return false;
    }

    const request = context.switchToHttp().getRequest<Request>();
    const user = request.user;

    if (!user || user.scope !== 'admin') {
      throw new ApplicationException(
        'Forbidden: Admin access required',
        ApplicationExceptionCode.FORBIDDEN,
      );
    }

    // Verify user is currently active in the database (token revocation upon deactivation)
    const adminRows = await this.db
      .select({
        id: adminUsersSchema.id,
        role: adminUsersSchema.role,
        isActive: adminUsersSchema.isActive,
        mustChangePassword: adminUsersSchema.mustChangePassword,
      })
      .from(adminUsersSchema)
      .where(eq(adminUsersSchema.id, user.id))
      .limit(1);

    if (adminRows.length === 0 || !adminRows[0].isActive) {
      throw new ApplicationException(
        'Account is deactivated or does not exist. Access revoked.',
        ApplicationExceptionCode.UNAUTHORIZED,
      );
    }

    // Synchronize latest database state to request.user
    user.role = adminRows[0].role;
    user.mustChangePassword = adminRows[0].mustChangePassword;

    return true;
  }
}
