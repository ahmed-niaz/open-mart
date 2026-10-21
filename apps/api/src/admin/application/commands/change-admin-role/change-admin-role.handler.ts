import { Inject, Logger } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';

import { ChangeAdminRoleCommand } from './change-admin-role.command.js';
import {
  ADMIN_USER_REPOSITORY,
  type AdminUserRepositoryPort,
} from '../../ports/admin-user.repository.js';
import {
  ADMIN_AUDIT_PORT,
  type AdminAuditPort,
} from '../../ports/admin-audit.port.js';
import { AdminId } from '../../../domain/value-objects/admin-id.vo.js';
import { AdminRoleVO } from '../../../domain/value-objects/admin-role.vo.js';
import {
  ApplicationException,
  ApplicationExceptionCode,
} from '../../../../shared/domain/exceptions/application.exception.js';

@CommandHandler(ChangeAdminRoleCommand)
export class ChangeAdminRoleCommandHandler implements ICommandHandler<
  ChangeAdminRoleCommand,
  void
> {
  private readonly logger = new Logger(ChangeAdminRoleCommandHandler.name);

  constructor(
    @Inject(ADMIN_USER_REPOSITORY)
    private readonly adminRepo: AdminUserRepositoryPort,
    @Inject(ADMIN_AUDIT_PORT)
    private readonly auditPort: AdminAuditPort,
  ) {}

  async execute(command: ChangeAdminRoleCommand): Promise<void> {
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

    const newRole = AdminRoleVO.create(command.newRole);

    // If demoting a super-admin, protect the last super-admin invariant
    if (targetAdmin.role.isSuperAdmin() && !newRole.isSuperAdmin()) {
      const superAdminCount = await this.adminRepo.countActiveSuperAdmins();
      if (superAdminCount <= 1) {
        throw new ApplicationException(
          'Cannot demote the last active super-admin.',
          ApplicationExceptionCode.CONFLICT,
        );
      }
    }

    const oldRole = targetAdmin.role.value;
    targetAdmin.changeRole(newRole, operator);

    await this.adminRepo.save(targetAdmin);

    await this.auditPort.recordLog({
      adminId: operator.id.value,
      action: 'ROLE_CHANGE',
      targetId: targetAdmin.id.value,
      details: {
        oldRole,
        newRole: newRole.value,
      },
    });
  }
}
