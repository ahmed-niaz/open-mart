import { SetMetadata } from '@nestjs/common';
import { AdminPermission } from '../../infrastructure/guards/admin-permissions.js';

export const PERMISSIONS_KEY = 'admin_permissions';

export const RequirePermissions = (...permissions: AdminPermission[]) =>
  SetMetadata(PERMISSIONS_KEY, permissions);
