import { Inject, Logger } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';

import { ActivateAdminUserCommand } from './activate-admin-user.command.js';
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

@CommandHandler(ActivateAdminUserCommand)
export class ActivateAdminUserCommandHandler implements ICommandHandler<
  ActivateAdminUserCommand,
  void
> {
  private readonly logger = new Logger(ActivateAdminUserCommandHandler.name);

  constructor(
    @Inject(ADMIN_USER_REPOSITORY)
    private readonly adminRepo: AdminUserRepositoryPort,
    @Inject(ADMIN_AUDIT_PORT)
    private readonly auditPort: AdminAuditPort,
  ) {}

  async execute(command: ActivateAdminUserCommand): Promise<void> {
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

    targetAdmin.activate(operator);

    await this.adminRepo.save(targetAdmin);

    await this.auditPort.recordLog({
      adminId: operator.id.value,
      action: 'ACTIVATION',
      targetId: targetAdmin.id.value,
    });
  }
}
