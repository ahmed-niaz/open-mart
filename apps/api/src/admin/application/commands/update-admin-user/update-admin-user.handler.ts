import { Inject, Logger } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';

import { UpdateAdminUserCommand } from './update-admin-user.command.js';
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

@CommandHandler(UpdateAdminUserCommand)
export class UpdateAdminUserCommandHandler implements ICommandHandler<
  UpdateAdminUserCommand,
  void
> {
  private readonly logger = new Logger(UpdateAdminUserCommandHandler.name);

  constructor(
    @Inject(ADMIN_USER_REPOSITORY)
    private readonly adminRepo: AdminUserRepositoryPort,
    @Inject(ADMIN_AUDIT_PORT)
    private readonly auditPort: AdminAuditPort,
  ) {}

  async execute(command: UpdateAdminUserCommand): Promise<void> {
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

    const isSelf = operator.id.equals(targetAdmin.id);
    if (!isSelf && !operator.role.canManage(targetAdmin.role)) {
      throw new ApplicationException(
        `Insufficient hierarchy rank: ${operator.role.value} cannot edit a ${targetAdmin.role.value}.`,
        ApplicationExceptionCode.FORBIDDEN,
      );
    }

    targetAdmin.updateProfile({
      firstName: command.firstName,
      lastName: command.lastName,
      phoneNumber: command.phoneNumber,
      avatarUrl: command.avatarUrl,
    });

    await this.adminRepo.save(targetAdmin);

    await this.auditPort.recordLog({
      adminId: operator.id.value,
      action: 'STAFF_UPDATED',
      targetId: targetAdmin.id.value,
      details: {
        firstName: command.firstName,
        lastName: command.lastName,
      },
    });
  }
}
