import { IsIn, IsNotEmpty } from 'class-validator';
import {
  ADMIN_ROLES,
  type AdminRole,
} from '../../../shared/infrastructure/guards/admin-permissions.js';

export class ChangeAdminRoleDto {
  @IsIn(ADMIN_ROLES, {
    message: `Role must be one of: ${ADMIN_ROLES.join(', ')}`,
  })
  @IsNotEmpty({ message: 'New role is required' })
  role!: AdminRole;
}
