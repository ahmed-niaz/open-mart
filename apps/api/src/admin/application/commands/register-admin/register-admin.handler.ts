import { Inject, Logger } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { ConfigService } from '@nestjs/config';

import { RegisterAdminCommand } from './register-admin.command.js';
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
import { AdminUser } from '../../../domain/entities/admin-user.entity.js';
import { AdminEmail } from '../../../domain/value-objects/admin-email.vo.js';
import { AdminRoleVO } from '../../../domain/value-objects/admin-role.vo.js';
import { AdminPasswordHash } from '../../../domain/value-objects/admin-password-hash.vo.js';
import {
  ApplicationException,
  ApplicationExceptionCode,
} from '../../../../shared/domain/exceptions/application.exception.js';
import type { AdminAuthResponseDto } from '../../dto/admin-auth-response.dto.js';

@CommandHandler(RegisterAdminCommand)
export class RegisterAdminCommandHandler implements ICommandHandler<
  RegisterAdminCommand,
  AdminAuthResponseDto
> {
  private readonly logger = new Logger(RegisterAdminCommandHandler.name);

  constructor(
    @Inject(ADMIN_USER_REPOSITORY)
    private readonly adminRepo: AdminUserRepositoryPort,
    @Inject(PASSWORD_HASHER_PORT)
    private readonly passwordHasher: PasswordHasherPort,
    @Inject(TOKEN_SERVICE_PORT)
    private readonly tokenService: TokenServicePort,
    @Inject(ADMIN_AUDIT_PORT)
    private readonly auditPort: AdminAuditPort,
    private readonly configService: ConfigService,
  ) {}

  async execute(command: RegisterAdminCommand): Promise<AdminAuthResponseDto> {
    const email = AdminEmail.create(command.email);

    // 1. Email Uniqueness Invariant
    const existing = await this.adminRepo.findByEmail(email);
    if (existing) {
      throw new ApplicationException(
        `Admin account with email '${command.email}' already exists.`,
        ApplicationExceptionCode.CONFLICT,
      );
    }

    // 2. Determine initial Super-Admin status or Secret verification
    const superAdminCount = await this.adminRepo.countActiveSuperAdmins();
    const isFirstAdmin = superAdminCount === 0;

    let roleVo: AdminRoleVO;
    if (isFirstAdmin) {
      this.logger.log(
        `No active super-admins found. Registering ${command.email} as initial super-admin.`,
      );
      roleVo = AdminRoleVO.create('super-admin');
    } else {
      const configuredSecret = this.configService.get<string>(
        'ADMIN_REGISTRATION_SECRET',
      );
      if (
        !configuredSecret ||
        command.registrationSecret !== configuredSecret
      ) {
        this.logger.warn(
          `Failed admin registration for '${command.email}': invalid secret provided`,
        );
        throw new ApplicationException(
          'Invalid or missing registration secret key. Contact your system administrator.',
          ApplicationExceptionCode.FORBIDDEN,
        );
      }
      roleVo = AdminRoleVO.create('admin');
    }

    // 3. Hash Password
    const passwordHashStr = await this.passwordHasher.hash(command.password);
    const passwordHash = AdminPasswordHash.create(passwordHashStr);

    // 4. Create and Persist Admin Entity
    const admin = AdminUser.create({
      email,
      passwordHash,
      firstName: command.firstName,
      lastName: command.lastName,
      role: roleVo,
      phoneNumber: command.phoneNumber || null,
      mustChangePassword: false,
    });

    await this.adminRepo.save(admin);

    // 5. Update last login timestamp and record audit
    await this.adminRepo.updateLastLogin(admin.id, command.ipAddress ?? null);

    await this.auditPort.recordLog({
      adminId: admin.id.value,
      action: isFirstAdmin ? 'INITIAL_BOOTSTRAP_REGISTER' : 'ADMIN_REGISTER',
      ipAddress: command.ipAddress,
      userAgent: command.userAgent,
    });

    // 6. Generate Session Tokens
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
