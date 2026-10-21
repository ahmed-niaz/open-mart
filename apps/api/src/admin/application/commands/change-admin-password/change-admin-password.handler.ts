import { Inject, Logger } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';

import { ChangeAdminPasswordCommand } from './change-admin-password.command.js';
import {
  ADMIN_USER_REPOSITORY,
  type AdminUserRepositoryPort,
} from '../../ports/admin-user.repository.js';
import {
  PASSWORD_HASHER_PORT,
  type PasswordHasherPort,
} from '../../../../shared/application/ports/password-hasher.port.js';
import {
  ADMIN_AUDIT_PORT,
  type AdminAuditPort,
} from '../../ports/admin-audit.port.js';
import { AdminId } from '../../../domain/value-objects/admin-id.vo.js';
import { AdminPasswordHash } from '../../../domain/value-objects/admin-password-hash.vo.js';
import {
  ApplicationException,
  ApplicationExceptionCode,
} from '../../../../shared/domain/exceptions/application.exception.js';

@CommandHandler(ChangeAdminPasswordCommand)
export class ChangeAdminPasswordCommandHandler implements ICommandHandler<
  ChangeAdminPasswordCommand,
  void
> {
  private readonly logger = new Logger(ChangeAdminPasswordCommandHandler.name);

  constructor(
    @Inject(ADMIN_USER_REPOSITORY)
    private readonly adminRepo: AdminUserRepositoryPort,
    @Inject(PASSWORD_HASHER_PORT)
    private readonly passwordHasher: PasswordHasherPort,
    @Inject(ADMIN_AUDIT_PORT)
    private readonly auditPort: AdminAuditPort,
  ) {}

  async execute(command: ChangeAdminPasswordCommand): Promise<void> {
    const admin = await this.adminRepo.findById(
      AdminId.create(command.adminId),
    );

    if (!admin || !admin.isActive) {
      throw new ApplicationException(
        'Administrator not found or deactivated.',
        ApplicationExceptionCode.UNAUTHORIZED,
      );
    }

    if (!command.newPassword || command.newPassword.length < 8) {
      throw new ApplicationException(
        'New password must be at least 8 characters long.',
        ApplicationExceptionCode.VALIDATION_ERROR,
      );
    }

    if (!admin.mustChangePassword) {
      if (!command.currentPassword) {
        throw new ApplicationException(
          'Current password is required to change password.',
          ApplicationExceptionCode.VALIDATION_ERROR,
        );
      }

      const isMatch = await this.passwordHasher.compare(
        command.currentPassword,
        admin.passwordHash.value,
      );

      if (!isMatch) {
        throw new ApplicationException(
          'Current password does not match.',
          ApplicationExceptionCode.UNAUTHORIZED,
        );
      }
    }

    const hashed = await this.passwordHasher.hash(command.newPassword);
    admin.changePassword(AdminPasswordHash.create(hashed));

    await this.adminRepo.save(admin);

    await this.auditPort.recordLog({
      adminId: admin.id.value,
      action: 'PASSWORD_CHANGE',
    });
  }
}
