import { beforeEach, describe, expect, it, vi } from 'vitest';

import { RegisterAdminCommandHandler } from '../../src/admin/application/commands/register-admin/register-admin.handler.js';
import { RegisterAdminCommand } from '../../src/admin/application/commands/register-admin/register-admin.command.js';
import { LoginAdminGoogleCommandHandler } from '../../src/admin/application/commands/login-admin-google/login-admin-google.handler.js';
import { LoginAdminGoogleCommand } from '../../src/admin/application/commands/login-admin-google/login-admin-google.command.js';

import { AdminUser } from '../../src/admin/domain/entities/admin-user.entity.js';
import { AdminId } from '../../src/admin/domain/value-objects/admin-id.vo.js';
import { AdminEmail } from '../../src/admin/domain/value-objects/admin-email.vo.js';
import { AdminRoleVO } from '../../src/admin/domain/value-objects/admin-role.vo.js';
import { AdminPasswordHash } from '../../src/admin/domain/value-objects/admin-password-hash.vo.js';
import { ApplicationException } from '../../src/shared/domain/exceptions/application.exception.js';

describe('Admin Registration & Google OAuth Command Handlers Unit Tests', () => {
  let mockAdminRepo: any;
  let mockPasswordHasher: any;
  let mockTokenService: any;
  let mockAuditPort: any;
  let mockGoogleAuth: any;
  let mockConfigService: any;

  beforeEach(() => {
    mockAdminRepo = {
      save: vi.fn().mockResolvedValue(undefined),
      findById: vi.fn(),
      findByEmail: vi.fn(),
      countActiveSuperAdmins: vi.fn().mockResolvedValue(1),
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
    };

    mockAuditPort = {
      recordLog: vi.fn().mockResolvedValue(undefined),
    };

    mockGoogleAuth = {
      getAuthorizationUrl: vi
        .fn()
        .mockReturnValue('https://accounts.google.com/o/oauth2/v2/auth?...'),
      exchangeCodeForProfile: vi.fn().mockResolvedValue({
        googleId: 'g-12345',
        email: 'admin@openmart.com',
        firstName: 'Google',
        lastName: 'Admin',
        avatarUrl: 'https://lh3.googleusercontent.com/...',
      }),
      verifyIdToken: vi.fn().mockResolvedValue({
        googleId: 'g-12345',
        email: 'admin@openmart.com',
        firstName: 'Google',
        lastName: 'Admin',
        avatarUrl: null,
      }),
    };

    mockConfigService = {
      get: vi.fn().mockImplementation((key: string) => {
        if (key === 'ADMIN_REGISTRATION_SECRET')
          return 'openmart-admin-secret-2026';
        if (key === 'ADMIN_WEB_URL') return 'http://localhost:5173';
        return null;
      }),
    };
  });

  describe('RegisterAdminCommandHandler', () => {
    it('should bootstrap first admin as super-admin without requiring a registration secret', async () => {
      mockAdminRepo.countActiveSuperAdmins.mockResolvedValueOnce(0);
      mockAdminRepo.findByEmail.mockResolvedValueOnce(null);

      const handler = new RegisterAdminCommandHandler(
        mockAdminRepo,
        mockPasswordHasher,
        mockTokenService,
        mockAuditPort,
        mockConfigService,
      );

      const command = new RegisterAdminCommand(
        'firstadmin@openmart.com',
        'Password123!@#',
        'First',
        'SuperAdmin',
      );

      const result = await handler.execute(command);

      expect(mockAdminRepo.save).toHaveBeenCalledTimes(1);
      const savedAdmin: AdminUser = mockAdminRepo.save.mock.calls[0][0];
      expect(savedAdmin.role.value).toBe('super-admin');
      expect(result.admin.role).toBe('super-admin');
      expect(result.accessToken).toBe('mock_access_jwt');
    });

    it('should allow subsequent admin registration when valid registration secret is provided', async () => {
      mockAdminRepo.countActiveSuperAdmins.mockResolvedValueOnce(1);
      mockAdminRepo.findByEmail.mockResolvedValueOnce(null);

      const handler = new RegisterAdminCommandHandler(
        mockAdminRepo,
        mockPasswordHasher,
        mockTokenService,
        mockAuditPort,
        mockConfigService,
      );

      const command = new RegisterAdminCommand(
        'staff@openmart.com',
        'Password123!@#',
        'Staff',
        'Member',
        '+8801700000000',
        'openmart-admin-secret-2026',
      );

      const result = await handler.execute(command);

      expect(mockAdminRepo.save).toHaveBeenCalledTimes(1);
      const savedAdmin: AdminUser = mockAdminRepo.save.mock.calls[0][0];
      expect(savedAdmin.role.value).toBe('admin');
      expect(result.admin.role).toBe('admin');
    });

    it('should reject registration if admins already exist and secret is invalid', async () => {
      mockAdminRepo.countActiveSuperAdmins.mockResolvedValueOnce(1);
      mockAdminRepo.findByEmail.mockResolvedValueOnce(null);

      const handler = new RegisterAdminCommandHandler(
        mockAdminRepo,
        mockPasswordHasher,
        mockTokenService,
        mockAuditPort,
        mockConfigService,
      );

      const command = new RegisterAdminCommand(
        'hacker@evil.com',
        'Password123!@#',
        'Evil',
        'User',
        undefined,
        'wrong-secret',
      );

      await expect(handler.execute(command)).rejects.toThrow(
        ApplicationException,
      );
    });

    it('should reject registration if email is already taken', async () => {
      const existingAdmin = AdminUser.reconstitute({
        id: AdminId.create(),
        email: AdminEmail.create('admin@openmart.com'),
        passwordHash: AdminPasswordHash.create('hash'),
        firstName: 'Existing',
        lastName: 'Admin',
        role: AdminRoleVO.create('admin'),
        phoneNumber: null,
        avatarUrl: null,
        isActive: true,
        mustChangePassword: false,
        version: 1,
        lastLoginAt: null,
        lastLoginIp: null,
        createdBy: null,
        deactivatedAt: null,
        deactivatedBy: null,
        deactivationReason: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      mockAdminRepo.findByEmail.mockResolvedValueOnce(existingAdmin);

      const handler = new RegisterAdminCommandHandler(
        mockAdminRepo,
        mockPasswordHasher,
        mockTokenService,
        mockAuditPort,
        mockConfigService,
      );

      const command = new RegisterAdminCommand(
        'admin@openmart.com',
        'Password123!@#',
        'Admin',
        'Two',
      );

      await expect(handler.execute(command)).rejects.toThrow(
        ApplicationException,
      );
    });
  });

  describe('LoginAdminGoogleCommandHandler', () => {
    it('should authenticate an existing admin with Google OAuth code', async () => {
      const existingAdmin = AdminUser.reconstitute({
        id: AdminId.create(),
        email: AdminEmail.create('admin@openmart.com'),
        passwordHash: AdminPasswordHash.create('hash'),
        firstName: 'Google',
        lastName: 'Admin',
        role: AdminRoleVO.create('super-admin'),
        phoneNumber: null,
        avatarUrl: null,
        isActive: true,
        mustChangePassword: false,
        version: 1,
        lastLoginAt: null,
        lastLoginIp: null,
        createdBy: null,
        deactivatedAt: null,
        deactivatedBy: null,
        deactivationReason: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      mockAdminRepo.findByEmail.mockResolvedValueOnce(existingAdmin);

      const handler = new LoginAdminGoogleCommandHandler(
        mockAdminRepo,
        mockGoogleAuth,
        mockTokenService,
        mockPasswordHasher,
        mockAuditPort,
      );

      const result = await handler.execute(
        new LoginAdminGoogleCommand('valid_oauth_code'),
      );

      expect(result.admin.email).toBe('admin@openmart.com');
      expect(result.accessToken).toBe('mock_access_jwt');
      expect(mockAdminRepo.updateLastLogin).toHaveBeenCalledTimes(1);
    });

    it('should auto-provision as super-admin on Google OAuth if table is empty', async () => {
      mockAdminRepo.findByEmail.mockResolvedValueOnce(null);
      mockAdminRepo.countActiveSuperAdmins.mockResolvedValueOnce(0);

      const handler = new LoginAdminGoogleCommandHandler(
        mockAdminRepo,
        mockGoogleAuth,
        mockTokenService,
        mockPasswordHasher,
        mockAuditPort,
      );

      const result = await handler.execute(
        new LoginAdminGoogleCommand('oauth_code_for_bootstrap'),
      );

      expect(mockAdminRepo.save).toHaveBeenCalledTimes(1);
      const saved = mockAdminRepo.save.mock.calls[0][0];
      expect(saved.role.value).toBe('super-admin');
      expect(result.admin.role).toBe('super-admin');
    });

    it('should reject Google login if account not found and system already has admins', async () => {
      mockAdminRepo.findByEmail.mockResolvedValueOnce(null);
      mockAdminRepo.countActiveSuperAdmins.mockResolvedValueOnce(1);

      const handler = new LoginAdminGoogleCommandHandler(
        mockAdminRepo,
        mockGoogleAuth,
        mockTokenService,
        mockPasswordHasher,
        mockAuditPort,
      );

      await expect(
        handler.execute(new LoginAdminGoogleCommand('unauthorized_code')),
      ).rejects.toThrow(ApplicationException);
    });
  });
});
