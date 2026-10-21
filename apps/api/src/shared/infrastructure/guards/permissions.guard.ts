import {
  CanActivate,
  ExecutionContext,
  Injectable,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';

import {
  ApplicationException,
  ApplicationExceptionCode,
} from '../../domain/exceptions/application.exception.js';
import {
  AdminPermission,
  AdminRole,
  ROLE_PERMISSIONS_MAP,
} from './admin-permissions.js';
import { PERMISSIONS_KEY } from '../../presentation/decorators/require-permissions.decorator.js';
import { ALLOW_PENDING_PASSWORD_CHANGE_KEY } from '../../presentation/decorators/allow-pending-password-change.decorator.js';

@Injectable()
export class PermissionsGuard implements CanActivate {
  private readonly logger = new Logger(PermissionsGuard.name);

  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const user = request.user;

    if (!user || user.scope !== 'admin') {
      throw new ApplicationException(
        'Unauthorized: Admin credentials required.',
        ApplicationExceptionCode.UNAUTHORIZED,
      );
    }

    // Check must_change_password enforcement
    const allowPending = this.reflector.getAllAndOverride<boolean>(
      ALLOW_PENDING_PASSWORD_CHANGE_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (user.mustChangePassword && !allowPending) {
      throw new ApplicationException(
        'Password change required before accessing other resources.',
        ApplicationExceptionCode.FORBIDDEN,
      );
    }

    // Deny by default: Route must explicitly declare permissions
    const requiredPermissions = this.reflector.getAllAndOverride<
      AdminPermission[] | undefined
    >(PERMISSIONS_KEY, [context.getHandler(), context.getClass()]);

    if (!requiredPermissions || requiredPermissions.length === 0) {
      throw new ApplicationException(
        'Forbidden: Access denied. Explicit permissions required.',
        ApplicationExceptionCode.FORBIDDEN,
      );
    }

    const userRole = user.role as AdminRole;
    const grantedPermissions = ROLE_PERMISSIONS_MAP[userRole];

    if (!grantedPermissions) {
      throw new ApplicationException(
        'Forbidden: Unrecognized or invalid admin role.',
        ApplicationExceptionCode.FORBIDDEN,
      );
    }

    const hasAll = requiredPermissions.every((perm) =>
      grantedPermissions.has(perm),
    );

    if (!hasAll) {
      throw new ApplicationException(
        'Forbidden: Insufficient permissions for this operation.',
        ApplicationExceptionCode.FORBIDDEN,
      );
    }

    return true;
  }
}
