import { beforeEach, describe, expect, it, vi } from 'vitest';

import { LoginAdminCommandHandler } from '../../src/admin/application/commands/login-admin/login-admin.handler.js';
import { LoginAdminCommand } from '../../src/admin/application/commands/login-admin/login-admin.command.js';
import { RefreshAdminTokenCommandHandler } from '../../src/admin/application/commands/refresh-admin-token/refresh-admin-token.handler.js';
import { RefreshAdminTokenCommand } from '../../src/admin/application/commands/refresh-admin-token/refresh-admin-token.command.js';
import { LogoutAdminCommandHandler } from '../../src/admin/application/commands/logout-admin/logout-admin.handler.js';
import { LogoutAdminCommand } from '../../src/admin/application/commands/logout-admin/logout-admin.command.js';
import { DeactivateAdminUserCommandHandler } from '../../src/admin/application/commands/deactivate-admin-user/deactivate-admin-user.handler.js';
import { DeactivateAdminUserCommand } from '../../src/admin/application/commands/deactivate-admin-user/deactivate-admin-user.command.js';
import { ChangeAdminPasswordCommandHandler } from '../../src/admin/application/commands/change-admin-password/change-admin-password.handler.js';
import { ChangeAdminPasswordCommand } from '../../src/admin/application/commands/change-admin-password/change-admin-password.command.js';

import { AdminUser } from '../../src/admin/domain/entities/admin-user.entity.js';
import { AdminId } from '../../src/admin/domain/value-objects/admin-id.vo.js';
import { AdminEmail } from '../../src/admin/domain/value-objects/admin-email.vo.js';
import { AdminRoleVO } from '../../src/admin/domain/value-objects/admin-role.vo.js';
import { AdminPasswordHash } from '../../src/admin/domain/value-objects/admin-password-hash.vo.js';
import {
  ApplicationExceptionCode,
} from '../../src/shared/domain/exceptions/application.exception.js';
import { hashToken } from '../../src/shared/infrastructure/auth/token-hash.util.js';

describe('Phase 4: DB Session & Refresh Token Revocation Unit Tests', () => {
  let mockAdminRepo: any;
  let mockSessionRepo: any;
  let mockPasswordHasher: any;
  let mockTokenService: any;
  let mockAuditPort: any;

  const adminIdStr = 'a0000000-0000-4000-a000-000000000001';
  const rawRefreshToken = 'initial_refresh_jwt_token_xyz';
  const rotatedRefreshToken = 'rotated_refresh_jwt_token_123';

  beforeEach(() => {
    mockAdminRepo = {
      save: vi.fn().mockResolvedValue(undefined),
      findById: vi.fn(),
      findByEmail: vi.fn(),
      countActiveSuperAdmins: vi.fn().mockResolvedValue(2),
      updateLastLogin: vi.fn().mockResolvedValue(undefined),
    };

    mockSessionRepo = {
      create: vi.fn().mockImplementation(async (dto: any) => ({
        id: 's0000000-0000-4000-a000-000000000001',
        ...dto,
        revokedAt: null,
        createdAt: new Date(),
      })),
      findByTokenHash: vi.fn(),
      revokeByTokenHash: vi.fn().mockResolvedValue(undefined),
      revokeAllByAdminId: vi.fn().mockResolvedValue(undefined),
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
        refreshToken: rotatedRefreshToken,
      }),
      verifyRefreshToken: vi.fn().mockResolvedValue({
        sub: adminIdStr,
        email: 'admin@openmart.com',
        scope: 'admin',
        role: 'super-admin',
      }),
      getRefreshTokenMaxAgeMs: vi.fn().mockReturnValue(27 * 24 * 60 * 60 * 1000),
    };

    mockAuditPort = {
      recordLog: vi.fn().mockResolvedValue(undefined),
    };
  });

  describe('Login session creation', () => {
    it('creates an active DB session with SHA-256 hashed refresh token on login', async () => {
      const admin = AdminUser.create({
        email: AdminEmail.create('admin@openmart.com'),
        passwordHash: AdminPasswordHash.create('hashed_Admin123!@#'),
        firstName: 'Super',
        lastName: 'Admin',
        role: AdminRoleVO.create('super-admin'),
      });
      mockAdminRepo.findByEmail.mockResolvedValue(admin);

      const handler = new LoginAdminCommandHandler(
        mockAdminRepo,
        mockSessionRepo,
        mockPasswordHasher,
        mockTokenService,
        mockAuditPort,
      );

      const result = await handler.execute(
        new LoginAdminCommand(
          'admin@openmart.com',
          'Admin123!@#',
          '192.168.1.100',
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
        ),
      );

      expect(result.accessToken).toBe('mock_access_jwt');
      expect(result.refreshToken).toBe(rotatedRefreshToken);

      expect(mockSessionRepo.create).toHaveBeenCalledTimes(1);
      const sessionPayload = mockSessionRepo.create.mock.calls[0][0];
      expect(sessionPayload.adminId).toBe(admin.id.value);
      expect(sessionPayload.tokenHash).toBe(hashToken(rotatedRefreshToken));
      expect(sessionPayload.ipAddress).toBe('192.168.1.100');
      expect(sessionPayload.deviceInfo).toBe(
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
      );
      expect(sessionPayload.expiresAt.getTime()).toBeGreaterThan(Date.now());
    });
  });

  describe('Refresh token rotation & verification', () => {
    it('successfully rotates session: revokes old token hash and registers newly generated token hash', async () => {
      const admin = AdminUser.create({
        email: AdminEmail.create('admin@openmart.com'),
        passwordHash: AdminPasswordHash.create('hash'),
        firstName: 'Active',
        lastName: 'Admin',
        role: AdminRoleVO.create('admin'),
      });
      mockAdminRepo.findById.mockResolvedValue(admin);

      const oldHash = hashToken(rawRefreshToken);
      mockSessionRepo.findByTokenHash.mockResolvedValue({
        id: 'session-123',
        adminId: admin.id.value,
        tokenHash: oldHash,
        deviceInfo: 'Chrome on MacOS',
        ipAddress: '10.0.0.1',
        expiresAt: new Date(Date.now() + 1000000),
        revokedAt: null,
        createdAt: new Date(),
      });

      const handler = new RefreshAdminTokenCommandHandler(
        mockAdminRepo,
        mockSessionRepo,
        mockTokenService,
      );

      const result = await handler.execute(
        new RefreshAdminTokenCommand(rawRefreshToken),
      );

      expect(result.accessToken).toBe('mock_access_jwt');
      expect(result.refreshToken).toBe(rotatedRefreshToken);

      // Verify old session revoked
      expect(mockSessionRepo.revokeByTokenHash).toHaveBeenCalledWith(oldHash);

      // Verify new session registered
      expect(mockSessionRepo.create).toHaveBeenCalledTimes(1);
      const newSession = mockSessionRepo.create.mock.calls[0][0];
      expect(newSession.adminId).toBe(admin.id.value);
      expect(newSession.tokenHash).toBe(hashToken(rotatedRefreshToken));
      expect(newSession.deviceInfo).toBe('Chrome on MacOS');
      expect(newSession.ipAddress).toBe('10.0.0.1');
    });

    it('detects token theft: if session is missing or revoked, all sessions for admin are immediately revoked', async () => {
      mockSessionRepo.findByTokenHash.mockResolvedValue(null);

      const handler = new RefreshAdminTokenCommandHandler(
        mockAdminRepo,
        mockSessionRepo,
        mockTokenService,
      );

      await expect(
        handler.execute(new RefreshAdminTokenCommand('reused_or_stolen_token')),
      ).rejects.toThrow(
        expect.objectContaining({
          code: ApplicationExceptionCode.UNAUTHORIZED,
        }),
      );

      // Suspected reuse -> wipes all sessions for this admin ID
      expect(mockSessionRepo.revokeAllByAdminId).toHaveBeenCalledWith(adminIdStr);
      expect(mockSessionRepo.create).not.toHaveBeenCalled();
    });

    it('rejects expired session and revokes the expired token hash', async () => {
      const expiredHash = hashToken(rawRefreshToken);
      mockSessionRepo.findByTokenHash.mockResolvedValue({
        id: 'expired-session',
        adminId: adminIdStr,
        tokenHash: expiredHash,
        expiresAt: new Date(Date.now() - 5000), // expired 5 seconds ago
        revokedAt: null,
      });

      const handler = new RefreshAdminTokenCommandHandler(
        mockAdminRepo,
        mockSessionRepo,
        mockTokenService,
      );

      await expect(
        handler.execute(new RefreshAdminTokenCommand(rawRefreshToken)),
      ).rejects.toThrow(/Session has expired/);

      expect(mockSessionRepo.revokeByTokenHash).toHaveBeenCalledWith(expiredHash);
      expect(mockSessionRepo.create).not.toHaveBeenCalled();
    });

    it('revokes all sessions if admin account is deactivated before refresh', async () => {
      const superAdmin = AdminUser.create({
        email: AdminEmail.create('boss@openmart.com'),
        passwordHash: AdminPasswordHash.create('hash'),
        firstName: 'Boss',
        lastName: 'Admin',
        role: AdminRoleVO.create('super-admin'),
      });

      const deactivatedAdmin = AdminUser.create({
        email: AdminEmail.create('fired@openmart.com'),
        passwordHash: AdminPasswordHash.create('hash'),
        firstName: 'Fired',
        lastName: 'Admin',
        role: AdminRoleVO.create('admin'),
      });
      deactivatedAdmin.deactivate(superAdmin, 'Fired');

      mockSessionRepo.findByTokenHash.mockResolvedValue({
        id: 'session-deact',
        adminId: deactivatedAdmin.id.value,
        tokenHash: hashToken(rawRefreshToken),
        expiresAt: new Date(Date.now() + 100000),
        revokedAt: null,
      });

      mockAdminRepo.findById.mockResolvedValue(deactivatedAdmin);

      const handler = new RefreshAdminTokenCommandHandler(
        mockAdminRepo,
        mockSessionRepo,
        mockTokenService,
      );

      await expect(
        handler.execute(new RefreshAdminTokenCommand(rawRefreshToken)),
      ).rejects.toThrow(/Account is deactivated/);

      expect(mockSessionRepo.revokeAllByAdminId).toHaveBeenCalledWith(
        adminIdStr,
      );
    });
  });

  describe('Logout server-side session revocation', () => {
    it('revokes server-side DB session using hashed refresh token upon logout', async () => {
      const handler = new LogoutAdminCommandHandler(mockSessionRepo);

      await handler.execute(new LogoutAdminCommand(rawRefreshToken));

      expect(mockSessionRepo.revokeByTokenHash).toHaveBeenCalledWith(
        hashToken(rawRefreshToken),
      );
    });

    it('gracefully handles logout when refresh token is null (e.g. cookie expired or absent)', async () => {
      const handler = new LogoutAdminCommandHandler(mockSessionRepo);

      await handler.execute(new LogoutAdminCommand(null));

      expect(mockSessionRepo.revokeByTokenHash).not.toHaveBeenCalled();
    });
  });

  describe('Account Lifecycle Revocations', () => {
    it('deactivating an admin immediately revokes all of their active sessions', async () => {
      const operator = AdminUser.create({
        email: AdminEmail.create('boss@openmart.com'),
        passwordHash: AdminPasswordHash.create('hash'),
        firstName: 'Super',
        lastName: 'Operator',
        role: AdminRoleVO.create('super-admin'),
      });

      const target = AdminUser.create({
        email: AdminEmail.create('target@openmart.com'),
        passwordHash: AdminPasswordHash.create('hash'),
        firstName: 'Target',
        lastName: 'Admin',
        role: AdminRoleVO.create('admin'),
      });

      mockAdminRepo.findById.mockImplementation(async (id: AdminId) => {
        if (id.equals(operator.id)) return operator;
        if (id.equals(target.id)) return target;
        return null;
      });

      const handler = new DeactivateAdminUserCommandHandler(
        mockAdminRepo,
        mockSessionRepo,
        mockAuditPort,
      );

      await handler.execute(
        new DeactivateAdminUserCommand(
          operator.id.value,
          target.id.value,
          'Policy violation',
        ),
      );

      expect(target.isActive).toBe(false);
      expect(mockAdminRepo.save).toHaveBeenCalledWith(target);
      expect(mockSessionRepo.revokeAllByAdminId).toHaveBeenCalledWith(
        target.id.value,
      );
    });

    it('changing password immediately revokes all active sessions to force re-login everywhere', async () => {
      const admin = AdminUser.create({
        email: AdminEmail.create('staff@openmart.com'),
        passwordHash: AdminPasswordHash.create('hashed_OldPass123!'),
        firstName: 'Staff',
        lastName: 'User',
        role: AdminRoleVO.create('admin'),
        mustChangePassword: false,
      });

      mockAdminRepo.findById.mockResolvedValue(admin);

      const handler = new ChangeAdminPasswordCommandHandler(
        mockAdminRepo,
        mockSessionRepo,
        mockPasswordHasher,
        mockAuditPort,
      );

      await handler.execute(
        new ChangeAdminPasswordCommand(
          admin.id.value,
          'NewBrandPassword456!',
          'OldPass123!',
        ),
      );

      expect(mockAdminRepo.save).toHaveBeenCalledWith(admin);
      expect(mockSessionRepo.revokeAllByAdminId).toHaveBeenCalledWith(
        admin.id.value,
      );
    });
  });
});
