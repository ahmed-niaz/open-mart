import { describe, expect, it } from 'vitest';
import { AdminUser } from '../../src/admin/domain/entities/admin-user.entity.js';
import { AdminEmail } from '../../src/admin/domain/value-objects/admin-email.vo.js';
import { AdminRoleVO } from '../../src/admin/domain/value-objects/admin-role.vo.js';
import { AdminPasswordHash } from '../../src/admin/domain/value-objects/admin-password-hash.vo.js';
import { AdminDomainException } from '../../src/admin/domain/exceptions/admin-domain.exception.js';

describe('Admin Domain Unit Tests', () => {
  describe('AdminEmail Value Object', () => {
    it('normalizes email by trimming and converting to lowercase', () => {
      const email = AdminEmail.create('  Admin.User@Example.COM  ');
      expect(email.value).toBe('admin.user@example.com');
    });

    it('rejects invalid email formats', () => {
      expect(() => AdminEmail.create('not-an-email')).toThrow(
        AdminDomainException,
      );
      expect(() => AdminEmail.create('@missing-local.com')).toThrow(
        AdminDomainException,
      );
      expect(() => AdminEmail.create('missing-domain@')).toThrow(
        AdminDomainException,
      );
      expect(() => AdminEmail.create('')).toThrow(AdminDomainException);
    });
  });

  describe('AdminRoleVO Value Object & Hierarchy', () => {
    const superAdmin = AdminRoleVO.create('super-admin');
    const admin = AdminRoleVO.create('admin');
    const manager = AdminRoleVO.create('manager');
    const support = AdminRoleVO.create('support');

    it('assigns correct hierarchical ranks', () => {
      expect(superAdmin.rank).toBe(4);
      expect(admin.rank).toBe(3);
      expect(manager.rank).toBe(2);
      expect(support.rank).toBe(1);
    });

    it('super-admin can manage and assign all roles', () => {
      expect(superAdmin.canManage(admin)).toBe(true);
      expect(superAdmin.canManage(manager)).toBe(true);
      expect(superAdmin.canManage(support)).toBe(true);
      expect(superAdmin.canManage(superAdmin)).toBe(true);

      expect(superAdmin.canAssignRole(superAdmin)).toBe(true);
      expect(superAdmin.canAssignRole(admin)).toBe(true);
      expect(superAdmin.canAssignRole(manager)).toBe(true);
      expect(superAdmin.canAssignRole(support)).toBe(true);
    });

    it('admin can only manage and assign roles strictly below itself (manager, support)', () => {
      expect(admin.canManage(manager)).toBe(true);
      expect(admin.canManage(support)).toBe(true);
      expect(admin.canManage(admin)).toBe(false);
      expect(admin.canManage(superAdmin)).toBe(false);

      expect(admin.canAssignRole(manager)).toBe(true);
      expect(admin.canAssignRole(support)).toBe(true);
      expect(admin.canAssignRole(admin)).toBe(false);
      expect(admin.canAssignRole(superAdmin)).toBe(false);
    });

    it('manager and support cannot manage or assign any staff roles', () => {
      expect(manager.canManage(support)).toBe(false);
      expect(manager.canManage(manager)).toBe(false);
      expect(support.canManage(support)).toBe(false);

      expect(manager.canAssignRole(support)).toBe(false);
      expect(support.canAssignRole(support)).toBe(false);
    });

    it('rejects invalid role strings', () => {
      expect(() => AdminRoleVO.create('guest')).toThrow(AdminDomainException);
      expect(() => AdminRoleVO.create('')).toThrow(AdminDomainException);
    });
  });

  describe('AdminUser Aggregate Root', () => {
    const createTestAdmin = (roleStr: string = 'admin'): AdminUser => {
      return AdminUser.create({
        email: AdminEmail.create(`test-${roleStr}@openmart.com`),
        passwordHash: AdminPasswordHash.create('hashed_secret_pw'),
        firstName: 'Jane',
        lastName: 'Doe',
        role: AdminRoleVO.create(roleStr),
        mustChangePassword: false,
      });
    };

    it('creates an admin with version 1 and emits AdminCreatedEvent', () => {
      const admin = createTestAdmin('admin');
      expect(admin.version).toBe(1);
      expect(admin.isActive).toBe(true);
      expect(admin.fullName).toBe('Jane Doe');

      const events = admin.getUncommittedEvents();
      expect(events.length).toBe(1);
      expect(events[0].constructor.name).toBe('AdminCreatedEvent');
    });

    it('updates profile and increments aggregate version', () => {
      const admin = createTestAdmin('admin');
      admin.updateProfile({
        firstName: 'Janet',
        lastName: 'Smith',
        phoneNumber: '+123456789',
      });

      expect(admin.firstName).toBe('Janet');
      expect(admin.lastName).toBe('Smith');
      expect(admin.fullName).toBe('Janet Smith');
      expect(admin.phoneNumber).toBe('+123456789');
      expect(admin.version).toBe(2);
    });

    it('changes password, clears mustChangePassword flag, and increments version', () => {
      const admin = AdminUser.create({
        email: AdminEmail.create('newbie@openmart.com'),
        passwordHash: AdminPasswordHash.create('temp_hash'),
        firstName: 'New',
        lastName: 'Staff',
        role: AdminRoleVO.create('support'),
        mustChangePassword: true,
      });

      expect(admin.mustChangePassword).toBe(true);
      admin.changePassword(AdminPasswordHash.create('new_permanent_hash'));

      expect(admin.mustChangePassword).toBe(false);
      expect(admin.passwordHash.value).toBe('new_permanent_hash');
      expect(admin.version).toBe(2);
    });

    it('prevents administrator from changing their own role', () => {
      const admin = createTestAdmin('admin');
      expect(() => {
        admin.changeRole(AdminRoleVO.create('super-admin'), admin);
      }).toThrow('Administrators cannot modify their own role.');
    });

    it('prevents administrator from modifying a higher or equal role', () => {
      const superAdminUser = createTestAdmin('super-admin');
      const adminUser = createTestAdmin('admin');

      expect(() => {
        superAdminUser.changeRole(AdminRoleVO.create('manager'), adminUser);
      }).toThrow(/Insufficient hierarchy rank/);
    });

    it('prevents administrator from assigning a role equal to or above their own rank', () => {
      const adminUser = createTestAdmin('admin');
      const supportUser = createTestAdmin('support');

      expect(() => {
        supportUser.changeRole(AdminRoleVO.create('admin'), adminUser);
      }).toThrow(/Insufficient hierarchy rank/);
    });

    it('allows super-admin to change a manager to support', () => {
      const superAdminUser = createTestAdmin('super-admin');
      const managerUser = createTestAdmin('manager');

      managerUser.changeRole(AdminRoleVO.create('support'), superAdminUser);
      expect(managerUser.role.value).toBe('support');
      expect(managerUser.version).toBe(2);
    });

    it('prevents administrator from deactivating their own account', () => {
      const admin = createTestAdmin('admin');
      expect(() => {
        admin.deactivate(admin, 'Self-deactivation attempt');
      }).toThrow('Administrators cannot deactivate their own account.');
    });

    it('prevents deactivating a higher ranking administrator', () => {
      const superAdmin = createTestAdmin('super-admin');
      const admin = createTestAdmin('admin');

      expect(() => {
        superAdmin.deactivate(admin, 'Demotion attempt');
      }).toThrow(/Insufficient hierarchy rank/);
    });

    it('successfully deactivates and reactivates a lower ranking administrator', () => {
      const superAdmin = createTestAdmin('super-admin');
      const support = createTestAdmin('support');

      support.deactivate(superAdmin, 'Left company');
      expect(support.isActive).toBe(false);
      expect(support.deactivationReason).toBe('Left company');
      expect(support.deactivatedBy?.equals(superAdmin.id)).toBe(true);

      support.activate(superAdmin);
      expect(support.isActive).toBe(true);
      expect(support.deactivationReason).toBeNull();
      expect(support.deactivatedBy).toBeNull();
    });
  });
});
