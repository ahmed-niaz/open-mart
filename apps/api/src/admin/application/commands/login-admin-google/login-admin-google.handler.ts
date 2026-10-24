import { Inject, Logger } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { randomBytes } from 'node:crypto';

import { LoginAdminGoogleCommand } from './login-admin-google.command.js';
import {
  ADMIN_USER_REPOSITORY,
  type AdminUserRepositoryPort,
} from '../../ports/admin-user.repository.js';
import {
  ADMIN_GOOGLE_AUTH_PORT,
  type AdminGoogleAuthPort,
} from '../../ports/admin-google-auth.port.js';
import {
  TOKEN_SERVICE_PORT,
  type TokenServicePort,
} from '../../../../shared/application/ports/token-service.port.js';
import {
  PASSWORD_HASHER_PORT,
  type PasswordHasherPort,
} from '../../../../shared/application/ports/password-hasher.port.js';
import {
  ADMIN_AUDIT_PORT,
  type AdminAuditPort,
} from '../../ports/admin-audit.port.js';
import { AdminUser } from '../../../domain/entities/admin-user.entity.js';
import { AdminEmail } from '../../../domain/value-objects/admin-email.vo.js';
import { AdminRoleVO } from '../../../domain/value-objects/admin-role.vo.js';
import { AdminPasswordHash } from '../../../domain/value-objects/admin-password-hash.vo.js';
import {
  ApplicationException,
  ApplicationExceptionCode,
} from '../../../../shared/domain/exceptions/application.exception.js';
import type { AdminAuthResponseDto } from '../../dto/admin-auth-response.dto.js';

@CommandHandler(LoginAdminGoogleCommand)
export class LoginAdminGoogleCommandHandler implements ICommandHandler<
  LoginAdminGoogleCommand,
  AdminAuthResponseDto
> {
  private readonly logger = new Logger(LoginAdminGoogleCommandHandler.name);

  constructor(
    @Inject(ADMIN_USER_REPOSITORY)
    private readonly adminRepo: AdminUserRepositoryPort,
    @Inject(ADMIN_GOOGLE_AUTH_PORT)
    private readonly googleAuth: AdminGoogleAuthPort,
    @Inject(TOKEN_SERVICE_PORT)
    private readonly tokenService: TokenServicePort,
    @Inject(PASSWORD_HASHER_PORT)
    private readonly passwordHasher: PasswordHasherPort,
    @Inject(ADMIN_AUDIT_PORT)
    private readonly auditPort: AdminAuditPort,
  ) {}

  async execute(
    command: LoginAdminGoogleCommand,
  ): Promise<AdminAuthResponseDto> {
    let profile;
    if (command.code) {
      profile = await this.googleAuth.exchangeCodeForProfile(command.code);
    } else if (command.idToken) {
      profile = await this.googleAuth.verifyIdToken(command.idToken);
    } else {
      throw new ApplicationException(
        'Either authorization code or idToken must be provided for Google OAuth.',
        ApplicationExceptionCode.UNAUTHORIZED,
      );
    }

    const email = AdminEmail.create(profile.email);
    let admin = await this.adminRepo.findByEmail(email);

    if (!admin) {
      // Check if this is initial setup (no super-admins)
      const superAdminCount = await this.adminRepo.countActiveSuperAdmins();
      if (superAdminCount === 0) {
        this.logger.log(
          `Bootstrapping initial Super Admin via Google OAuth: ${profile.email}`,
        );
        const randomPassword = randomBytes(24).toString('hex');
        const hashStr = await this.passwordHasher.hash(randomPassword);

        admin = AdminUser.create({
          email,
          passwordHash: AdminPasswordHash.create(hashStr),
          firstName: profile.firstName,
          lastName: profile.lastName,
          role: AdminRoleVO.create('super-admin'),
          avatarUrl: profile.avatarUrl,
          mustChangePassword: false,
        });

        await this.adminRepo.save(admin);
      } else {
        this.logger.warn(
          `Unauthorized Google Admin login attempt from '${profile.email}'`,
        );
        throw new ApplicationException(
          'No admin account found matching this Google email address. Access restricted.',
          ApplicationExceptionCode.FORBIDDEN,
        );
      }
    }

    if (!admin.isActive) {
      throw new ApplicationException(
        'Admin account has been deactivated.',
        ApplicationExceptionCode.UNAUTHORIZED,
      );
    }

    await this.adminRepo.updateLastLogin(admin.id, command.ipAddress ?? null);

    await this.auditPort.recordLog({
      adminId: admin.id.value,
      action: 'GOOGLE_OAUTH_LOGIN',
      ipAddress: command.ipAddress,
      userAgent: command.userAgent,
    });

    const tokenPair = await this.tokenService.generateTokenPair({
      sub: admin.id.value,
      email: admin.email.value,
      scope: 'admin',
      role: admin.role.value,
    });

    return {
      accessToken: tokenPair.accessToken,
      refreshToken: tokenPair.refreshToken,
      admin: {
        id: admin.id.value,
        email: admin.email.value,
        firstName: admin.firstName,
        lastName: admin.lastName,
        fullName: admin.fullName,
        role: admin.role.value,
        avatarUrl: admin.avatarUrl,
        mustChangePassword: admin.mustChangePassword,
      },
    };
  }
}
