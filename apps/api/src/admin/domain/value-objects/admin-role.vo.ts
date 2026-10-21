import { AdminDomainException } from '../exceptions/admin-domain.exception.js';
import {
  ADMIN_ROLES,
  type AdminRole as AdminRoleType,
} from '../../../shared/infrastructure/guards/admin-permissions.js';

const ROLE_RANKS: Record<AdminRoleType, number> = {
  support: 1,
  manager: 2,
  admin: 3,
  'super-admin': 4,
};

export class AdminRoleVO {
  private readonly _value: AdminRoleType;

  private constructor(value: AdminRoleType) {
    this._value = value;
  }

  static create(role: string): AdminRoleVO {
    if (!role || typeof role !== 'string') {
      throw new AdminDomainException('Admin role cannot be empty');
    }

    const normalized = role.trim().toLowerCase() as AdminRoleType;
    if (!ADMIN_ROLES.includes(normalized)) {
      throw new AdminDomainException(
        `Invalid admin role '${role}'. Allowed roles: ${ADMIN_ROLES.join(', ')}`,
      );
    }

    return new AdminRoleVO(normalized);
  }

  get value(): AdminRoleType {
    return this._value;
  }

  get rank(): number {
    return ROLE_RANKS[this._value];
  }

  isSuperAdmin(): boolean {
    return this._value === 'super-admin';
  }

  isAdmin(): boolean {
    return this._value === 'admin';
  }

  isManager(): boolean {
    return this._value === 'manager';
  }

  isSupport(): boolean {
    return this._value === 'support';
  }

  /**
   * Evaluates if this role has the authority to manage an account of targetRole.
   * - super-admin can manage all roles.
   * - admin can only manage roles strictly below itself (manager, support).
   * - manager & support cannot manage staff.
   */
  canManage(targetRole: AdminRoleVO): boolean {
    if (this.isSuperAdmin()) return true;
    if (this.isAdmin()) return targetRole.rank < this.rank;
    return false;
  }

  /**
   * Evaluates if this role has the authority to assign newRole to a user.
   * - super-admin can assign any role.
   * - admin can only assign roles strictly below itself (manager, support).
   */
  canAssignRole(newRole: AdminRoleVO): boolean {
    if (this.isSuperAdmin()) return true;
    if (this.isAdmin()) return newRole.rank < this.rank;
    return false;
  }

  equals(other: AdminRoleVO | null | undefined): boolean {
    if (!other) return false;
    return this._value === other._value;
  }

  toString(): string {
    return this._value;
  }
}
