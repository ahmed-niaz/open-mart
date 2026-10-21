import { beforeEach, describe, expect, it, vi } from 'vitest';

import { LoginAdminCommandHandler } from '../../src/admin/application/commands/login-admin/login-admin.handler.js';
import { LoginAdminCommand } from '../../src/admin/application/commands/login-admin/login-admin.command.js';
import { RefreshAdminTokenCommandHandler } from '../../src/admin/application/commands/refresh-admin-token/refresh-admin-token.handler.js';
import { RefreshAdminTokenCommand } from '../../src/admin/application/commands/refresh-admin-token/refresh-admin-token.command.js';
import { CreateAdminUserCommandHandler } from '../../src/admin/application/commands/create-admin-user/create-admin-user.handler.js';
import { CreateAdminUserCommand } from '../../src/admin/application/commands/create-admin-user/create-admin-user.command.js';
import { ChangeAdminRoleCommandHandler } from '../../src/admin/application/commands/change-admin-role/change-admin-role.handler.js';
import { ChangeAdminRoleCommand } from '../../src/admin/application/commands/change-admin-role/change-admin-role.command.js';
import { DeactivateAdminUserCommandHandler } from '../../src/admin/application/commands/deactivate-admin-user/deactivate-admin-user.handler.js';
import { DeactivateAdminUserCommand } from '../../src/admin/application/commands/deactivate-admin-user/deactivate-admin-user.command.js';
import { ChangeAdminPasswordCommandHandler } from '../../src/admin/application/commands/change-admin-password/change-admin-password.handler.js';
import { ChangeAdminPasswordCommand } from '../../src/admin/application/commands/change-admin-password/change-admin-password.command.js';

import { AdminUser } from '../../src/admin/domain/entities/admin-user.entity.js';
import { AdminId } from '../../src/admin/domain/value-objects/admin-id.vo.js';
import { AdminEmail } from '../../src/admin/domain/value-objects/admin-email.vo.js';
import { AdminRoleVO } from '../../src/admin/domain/value-objects/admin-role.vo.js';
import { AdminPasswordHash } from '../../src/admin/domain/value-objects/admin-password-hash.vo.js';
import { ApplicationException } from '../../src/shared/domain/exceptions/application.exception.js';

describe('Admin Command Handlers Unit Tests', () => {
  let mockAdminRepo: any;
  let mockPasswordHasher: any;
  let mockTokenService: any;
  let mockAuditPort: any;

  beforeEach(() => {
    mockAdminRepo = {
      save: vi.fn().mockResolvedValue(undefined),
      findById: vi.fn(),
      findByEmail: vi.fn(),
      countActiveSuperAdmins: vi.fn().mockResolvedValue(2),
      updateLastLogin: vi.fn().mockResolvedValue(undefined),
    };

    mockPasswordHasher = {
      hash: vi.fn().mockImplementation(async (pw: string) => `hashed_${pw}`),
      compare: vi
        .fn()
        .mockImplementation(
          async (pw: string, hash: string) => hash === `hashed_${pw}`,
        ),
    };

    mockTokenService = {
      generateTokenPair: vi.fn().mockResolvedValue({
        accessToken: 'mock_access_jwt',
        refreshToken: 'mock_refresh_jwt',
      }),
      verifyRefreshToken: vi.fn().mockResolvedValue({
        sub: 'a0000000-0000-4000-a000-000000000001',
        email: 'admin@openmart.com',
        scope: 'admin',
        role: 'super-admin',
      }),
    };

    mockAuditPort = {
      recordLog: vi.fn().mockResolvedValue(undefined),
    };
  });

  describe('LoginAdminCommandHandler', () => {
    it('successfully logs in, updates lastLogin unversioned, and returns tokens', async () => {
      const handler = new LoginAdminCommandHandler(
        mockAdminRepo,
        mockPasswordHasher,
        mockTokenService,
        mockAuditPort,
      );

      const admin = AdminUser.create({
        email: AdminEmail.create('admin@openmart.com'),
        passwordHash: AdminPasswordHash.create('hashed_Admin123!@#'),
        firstName: 'Super',
        lastName: 'Admin',
        role: AdminRoleVO.create('super-admin'),
      });
      mockAdminRepo.findByEmail.mockResolvedValue(admin);

      const result = await handler.execute(
        new LoginAdminCommand(
          'admin@openmart.com',
          'Admin123!@#',
          '127.0.0.1',
          'Mozilla',
        ),
      );

      expect(result.accessToken).toBe('mock_access_jwt');
      expect(result.admin.email).toBe('admin@openmart.com');
      expect(mockAdminRepo.updateLastLogin).toHaveBeenCalledWith(
        admin.id,
        '127.0.0.1',
      );
      expect(mockAuditPort.recordLog).toHaveBeenCalled();
    });

    it('throws UNAUTHORIZED on wrong password', async () => {
      const handler = new LoginAdminCommandHandler(
        mockAdminRepo,
        mockPasswordHasher,
        mockTokenService,
        mockAuditPort,
      );

      const admin = AdminUser.create({
        email: AdminEmail.create('admin@openmart.com'),
        passwordHash: AdminPasswordHash.create('hashed_Admin123!@#'),
        firstName: 'Super',
        lastName: 'Admin',
        role: AdminRoleVO.create('super-admin'),
      });
      mockAdminRepo.findByEmail.mockResolvedValue(admin);

      await expect(
        handler.execute(
          new LoginAdminCommand('admin@openmart.com', 'WrongPassword'),
        ),
      ).rejects.toThrow(ApplicationException);
    });

    it('rejects deactivated account immediately', async () => {
      const handler = new LoginAdminCommandHandler(
        mockAdminRepo,
        mockPasswordHasher,
        mockTokenService,
        mockAuditPort,
      );

      const superAdmin = AdminUser.create({
        email: AdminEmail.create('boss@openmart.com'),
        passwordHash: AdminPasswordHash.create('hashed_pw'),
        firstName: 'Boss',
        lastName: 'Admin',
        role: AdminRoleVO.create('super-admin'),
      });

      const staff = AdminUser.create({
        email: AdminEmail.create('fired@openmart.com'),
        passwordHash: AdminPasswordHash.create('hashed_pw'),
        firstName: 'Fired',
        lastName: 'Staff',
        role: AdminRoleVO.create('support'),
      });
      staff.deactivate(superAdmin, 'Terminated');

      mockAdminRepo.findByEmail.mockResolvedValue(staff);

      await expect(
        handler.execute(new LoginAdminCommand('fired@openmart.com', 'pw')),
      ).rejects.toThrow(/Account is deactivated/);
    });
  });

  describe('RefreshAdminTokenCommandHandler', () => {
    it('successfully refreshes token pair for active admin', async () => {
      const handler = new RefreshAdminTokenCommandHandler(
        mockAdminRepo,
        mockTokenService,
      );

      const admin = AdminUser.create({
        email: AdminEmail.create('admin@openmart.com'),
        passwordHash: AdminPasswordHash.create('hash'),
        firstName: 'Active',
        lastName: 'Admin',
        role: AdminRoleVO.create('admin'),
      });
      mockAdminRepo.findById.mockResolvedValue(admin);

      const result = await handler.execute(
        new RefreshAdminTokenCommand('valid_refresh_jwt'),
      );
      expect(result.accessToken).toBe('mock_access_jwt');
      expect(result.refreshToken).toBe('mock_refresh_jwt');
    });

    it('rejects refresh when token scope is not admin', async () => {
      const handler = new RefreshAdminTokenCommandHandler(
        mockAdminRepo,
        mockTokenService,
      );

      mockTokenService.verifyRefreshToken.mockResolvedValueOnce({
        sub: 'cust-1',
        email: 'cust@example.com',
        scope: 'customer',
      });

      await expect(
        handler.execute(new RefreshAdminTokenCommand('cust_refresh_jwt')),
      ).rejects.toThrow(/Admin refresh token required/);
    });
  });

  describe('CreateAdminUserCommandHandler & Hierarchy', () => {
    it('allows super-admin to create an admin', async () => {
      const handler = new CreateAdminUserCommandHandler(
        mockAdminRepo,
        mockPasswordHasher,
        mockAuditPort,
      );

      const superAdmin = AdminUser.create({
        email: AdminEmail.create('boss@openmart.com'),
        passwordHash: AdminPasswordHash.create('hash'),
        firstName: 'Boss',
        lastName: 'Admin',
        role: AdminRoleVO.create('super-admin'),
      });
      mockAdminRepo.findById.mockResolvedValue(superAdmin);
      mockAdminRepo.findByEmail.mockResolvedValue(null);

      const result = await handler.execute(
        new CreateAdminUserCommand(
          superAdmin.id.value,
          'new.admin@openmart.com',
          'SecurePass123',
          'New',
          'Admin',
          'admin',
        ),
      );

      expect(result.email).toBe('new.admin@openmart.com');
      expect(result.role).toBe('admin');
      expect(result.mustChangePassword).toBe(true);
      expect(mockAdminRepo.save).toHaveBeenCalled();
    });

    it('prevents admin from creating a super-admin (hierarchy violation)', async () => {
      const handler = new CreateAdminUserCommandHandler(
        mockAdminRepo,
        mockPasswordHasher,
        mockAuditPort,
      );

      const admin = AdminUser.create({
        email: AdminEmail.create('staff@openmart.com'),
        passwordHash: AdminPasswordHash.create('hash'),
        firstName: 'Staff',
        lastName: 'Admin',
        role: AdminRoleVO.create('admin'),
      });
      mockAdminRepo.findById.mockResolvedValue(admin);

      await expect(
        handler.execute(
          new CreateAdminUserCommand(
            admin.id.value,
            'hack@openmart.com',
            'SecurePass123',
            'Hack',
            'Boss',
            'super-admin',
          ),
        ),
      ).rejects.toThrow(/Insufficient hierarchy rank/);
    });
  });

  describe('ChangeAdminRoleCommandHandler & Last Super-Admin Invariant', () => {
    it('prevents demoting the last active super-admin', async () => {
      const handler = new ChangeAdminRoleCommandHandler(
        mockAdminRepo,
        mockAuditPort,
      );

      const superAdmin1 = AdminUser.create({
        email: AdminEmail.create('sole-super@openmart.com'),
        passwordHash: AdminPasswordHash.create('hash'),
        firstName: 'Sole',
        lastName: 'Super',
        role: AdminRoleVO.create('super-admin'),
      });

      const superAdmin2 = AdminUser.create({
        email: AdminEmail.create('operator@openmart.com'),
        passwordHash: AdminPasswordHash.create('hash'),
        firstName: 'Op',
        lastName: 'Super',
        role: AdminRoleVO.create('super-admin'),
      });

      mockAdminRepo.findById.mockImplementation(async (id: AdminId) => {
        if (id.equals(superAdmin1.id)) return superAdmin1;
        return superAdmin2;
      });

      // Only 1 active super-admin remains
      mockAdminRepo.countActiveSuperAdmins.mockResolvedValue(1);

      await expect(
        handler.execute(
          new ChangeAdminRoleCommand(
            superAdmin2.id.value,
            superAdmin1.id.value,
            'admin',
          ),
        ),
      ).rejects.toThrow(/Cannot demote the last active super-admin/);
    });
  });

  describe('DeactivateAdminUserCommandHandler & Invariants', () => {
    it('prevents deactivating the last active super-admin', async () => {
      const handler = new DeactivateAdminUserCommandHandler(
        mockAdminRepo,
        mockAuditPort,
      );

      const target = AdminUser.create({
        email: AdminEmail.create('target@openmart.com'),
        passwordHash: AdminPasswordHash.create('hash'),
        firstName: 'Target',
        lastName: 'Super',
        role: AdminRoleVO.create('super-admin'),
      });

      const operator = AdminUser.create({
        email: AdminEmail.create('op@openmart.com'),
        passwordHash: AdminPasswordHash.create('hash'),
        firstName: 'Operator',
        lastName: 'Super',
        role: AdminRoleVO.create('super-admin'),
      });

      mockAdminRepo.findById.mockImplementation(async (id: AdminId) => {
        if (id.equals(target.id)) return target;
        return operator;
      });

      mockAdminRepo.countActiveSuperAdmins.mockResolvedValue(1);

      await expect(
        handler.execute(
          new DeactivateAdminUserCommand(
            operator.id.value,
            target.id.value,
            'Retiring',
          ),
        ),
      ).rejects.toThrow(/Cannot deactivate the last active super-admin/);
    });

    it('prevents self-deactivation', async () => {
      const handler = new DeactivateAdminUserCommandHandler(
        mockAdminRepo,
        mockAuditPort,
      );

      const admin = AdminUser.create({
        email: AdminEmail.create('me@openmart.com'),
        passwordHash: AdminPasswordHash.create('hash'),
        firstName: 'Me',
        lastName: 'Admin',
        role: AdminRoleVO.create('admin'),
      });

      mockAdminRepo.findById.mockResolvedValue(admin);

      await expect(
        handler.execute(
          new DeactivateAdminUserCommand(
            admin.id.value,
            admin.id.value,
            'Suicide',
          ),
        ),
      ).rejects.toThrow(/Administrators cannot deactivate their own account/);
    });
  });

  describe('ChangeAdminPasswordCommandHandler', () => {
    it('successfully changes password and clears mustChangePassword', async () => {
      const handler = new ChangeAdminPasswordCommandHandler(
        mockAdminRepo,
        mockPasswordHasher,
        mockAuditPort,
      );

      const admin = AdminUser.create({
        email: AdminEmail.create('staff@openmart.com'),
        passwordHash: AdminPasswordHash.create('hashed_temp123'),
        firstName: 'Staff',
        lastName: 'User',
        role: AdminRoleVO.create('support'),
        mustChangePassword: true,
      });

      mockAdminRepo.findById.mockResolvedValue(admin);

      await handler.execute(
        new ChangeAdminPasswordCommand(admin.id.value, 'NewSecurePass123!'),
      );

      expect(admin.mustChangePassword).toBe(false);
      expect(admin.passwordHash.value).toBe('hashed_NewSecurePass123!');
      expect(mockAdminRepo.save).toHaveBeenCalledWith(admin);
    });
  });
});
