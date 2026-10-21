import { Inject, Logger } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';

import { LoginAdminCommand } from './login-admin.command.js';
import {
  ADMIN_USER_REPOSITORY,
  type AdminUserRepositoryPort,
} from '../../ports/admin-user.repository.js';
import {
  PASSWORD_HASHER_PORT,
  type PasswordHasherPort,
} from '../../../../shared/application/ports/password-hasher.port.js';
import {
  TOKEN_SERVICE_PORT,
  type TokenServicePort,
} from '../../../../shared/application/ports/token-service.port.js';
import {
  ADMIN_AUDIT_PORT,
  type AdminAuditPort,
} from '../../ports/admin-audit.port.js';
import { AdminEmail } from '../../../domain/value-objects/admin-email.vo.js';
import {
  ApplicationException,
  ApplicationExceptionCode,
} from '../../../../shared/domain/exceptions/application.exception.js';
import type { AdminAuthResponseDto } from '../../dto/admin-auth-response.dto.js';

@CommandHandler(LoginAdminCommand)
export class LoginAdminCommandHandler implements ICommandHandler<
  LoginAdminCommand,
  AdminAuthResponseDto
> {
  private readonly logger = new Logger(LoginAdminCommandHandler.name);

  constructor(
    @Inject(ADMIN_USER_REPOSITORY)
    private readonly adminRepo: AdminUserRepositoryPort,
    @Inject(PASSWORD_HASHER_PORT)
    private readonly passwordHasher: PasswordHasherPort,
    @Inject(TOKEN_SERVICE_PORT)
    private readonly tokenService: TokenServicePort,
    @Inject(ADMIN_AUDIT_PORT)
    private readonly auditPort: AdminAuditPort,
  ) {}

  async execute(command: LoginAdminCommand): Promise<AdminAuthResponseDto> {
    const email = AdminEmail.create(command.email);
    const admin = await this.adminRepo.findByEmail(email);

    if (!admin) {
      this.logger.warn(
        `Failed admin login attempt: email not found '${command.email}'`,
      );
      throw new ApplicationException(
        'Invalid email or password.',
        ApplicationExceptionCode.UNAUTHORIZED,
      );
    }

    if (!admin.isActive) {
      this.logger.warn(`Deactivated admin attempted login: '${command.email}'`);
      throw new ApplicationException(
        'Account is deactivated. Access revoked.',
        ApplicationExceptionCode.UNAUTHORIZED,
      );
    }

    const isMatch = await this.passwordHasher.compare(
      command.password,
      admin.passwordHash.value,
    );

    if (!isMatch) {
      this.logger.warn(
        `Failed admin login attempt: invalid password for '${command.email}'`,
      );
      throw new ApplicationException(
        'Invalid email or password.',
        ApplicationExceptionCode.UNAUTHORIZED,
      );
    }

    // Direct unversioned atomic SQL update for lastLogin (avoids OCC conflicts)
    await this.adminRepo.updateLastLogin(admin.id, command.ipAddress);

    // Record immutable audit entry
    await this.auditPort.recordLog({
      adminId: admin.id.value,
      action: 'LOGIN',
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
