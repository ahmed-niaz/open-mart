import { AdminUser } from '../../domain/entities/admin-user.entity.js';
import { AdminId } from '../../domain/value-objects/admin-id.vo.js';
import { AdminEmail } from '../../domain/value-objects/admin-email.vo.js';

export const ADMIN_USER_REPOSITORY = Symbol('ADMIN_USER_REPOSITORY');

export interface AdminUserRepositoryPort {
  save(admin: AdminUser): Promise<void>;
  findById(id: AdminId): Promise<AdminUser | null>;
  findByEmail(email: AdminEmail): Promise<AdminUser | null>;
  countActiveSuperAdmins(): Promise<number>;
  updateLastLogin(adminId: AdminId, ip: string | null): Promise<void>;
}
