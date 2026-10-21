import { Inject, Logger } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';

import { DeactivateAdminUserCommand } from './deactivate-admin-user.command.js';
import {
  ADMIN_USER_REPOSITORY,
  type AdminUserRepositoryPort,
} from '../../ports/admin-user.repository.js';
import {
  ADMIN_AUDIT_PORT,
  type AdminAuditPort,
} from '../../ports/admin-audit.port.js';
import { AdminId } from '../../../domain/value-objects/admin-id.vo.js';
import {
  ApplicationException,
  ApplicationExceptionCode,
} from '../../../../shared/domain/exceptions/application.exception.js';

@CommandHandler(DeactivateAdminUserCommand)
export class DeactivateAdminUserCommandHandler implements ICommandHandler<
  DeactivateAdminUserCommand,
  void
> {
  private readonly logger = new Logger(DeactivateAdminUserCommandHandler.name);

  constructor(
    @Inject(ADMIN_USER_REPOSITORY)
    private readonly adminRepo: AdminUserRepositoryPort,
    @Inject(ADMIN_AUDIT_PORT)
    private readonly auditPort: AdminAuditPort,
  ) {}

  async execute(command: DeactivateAdminUserCommand): Promise<void> {
    const operator = await this.adminRepo.findById(
      AdminId.create(command.operatorId),
    );
    if (!operator || !operator.isActive) {
      throw new ApplicationException(
        'Operator not found or deactivated.',
        ApplicationExceptionCode.UNAUTHORIZED,
      );
    }

    const targetAdmin = await this.adminRepo.findById(
      AdminId.create(command.targetAdminId),
    );
    if (!targetAdmin) {
      throw new ApplicationException(
        'Administrator not found.',
        ApplicationExceptionCode.NOT_FOUND,
      );
    }

    if (operator.id.equals(targetAdmin.id)) {
      throw new ApplicationException(
        'Administrators cannot deactivate their own account.',
        ApplicationExceptionCode.VALIDATION_ERROR,
      );
    }

    if (targetAdmin.role.isSuperAdmin()) {
      const superAdminCount = await this.adminRepo.countActiveSuperAdmins();
      if (superAdminCount <= 1) {
        throw new ApplicationException(
          'Cannot deactivate the last active super-admin.',
          ApplicationExceptionCode.CONFLICT,
        );
      }
    }

    targetAdmin.deactivate(operator, command.reason);

    await this.adminRepo.save(targetAdmin);

    await this.auditPort.recordLog({
      adminId: operator.id.value,
      action: 'DEACTIVATION',
      targetId: targetAdmin.id.value,
      details: {
        reason: command.reason,
      },
    });
  }
}
