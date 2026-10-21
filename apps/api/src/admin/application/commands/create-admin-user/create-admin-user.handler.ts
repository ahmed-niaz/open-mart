import { Inject, Logger } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';

import { CreateAdminUserCommand } from './create-admin-user.command.js';
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
import { AdminUser } from '../../../domain/entities/admin-user.entity.js';
import { AdminId } from '../../../domain/value-objects/admin-id.vo.js';
import { AdminEmail } from '../../../domain/value-objects/admin-email.vo.js';
import { AdminRoleVO } from '../../../domain/value-objects/admin-role.vo.js';
import { AdminPasswordHash } from '../../../domain/value-objects/admin-password-hash.vo.js';
import {
  ApplicationException,
  ApplicationExceptionCode,
} from '../../../../shared/domain/exceptions/application.exception.js';

export interface CreatedAdminUserResult {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  fullName: string;
  role: string;
  phoneNumber: string | null;
  avatarUrl: string | null;
  isActive: boolean;
  mustChangePassword: boolean;
  createdAt: Date;
}

@CommandHandler(CreateAdminUserCommand)
export class CreateAdminUserCommandHandler implements ICommandHandler<
  CreateAdminUserCommand,
  CreatedAdminUserResult
> {
  private readonly logger = new Logger(CreateAdminUserCommandHandler.name);

  constructor(
    @Inject(ADMIN_USER_REPOSITORY)
    private readonly adminRepo: AdminUserRepositoryPort,
    @Inject(PASSWORD_HASHER_PORT)
    private readonly passwordHasher: PasswordHasherPort,
    @Inject(ADMIN_AUDIT_PORT)
    private readonly auditPort: AdminAuditPort,
  ) {}

  async execute(
    command: CreateAdminUserCommand,
  ): Promise<CreatedAdminUserResult> {
    const operator = await this.adminRepo.findById(
      AdminId.create(command.operatorId),
    );

    if (!operator || !operator.isActive) {
      throw new ApplicationException(
        'Operator not found or deactivated.',
        ApplicationExceptionCode.UNAUTHORIZED,
      );
    }

    const targetRole = AdminRoleVO.create(command.role);

    // Enforce role hierarchy: operator cannot assign roles equal to or above their own rank
    if (!operator.role.canAssignRole(targetRole)) {
      throw new ApplicationException(
        `Insufficient hierarchy rank: ${operator.role.value} cannot create a user with role ${targetRole.value}.`,
        ApplicationExceptionCode.FORBIDDEN,
      );
    }

    const email = AdminEmail.create(command.email);
    const existing = await this.adminRepo.findByEmail(email);

    if (existing) {
      throw new ApplicationException(
        `Administrator with email '${command.email}' already exists.`,
        ApplicationExceptionCode.CONFLICT,
      );
    }

    if (!command.password || command.password.length < 8) {
      throw new ApplicationException(
        'Password must be at least 8 characters long.',
        ApplicationExceptionCode.VALIDATION_ERROR,
      );
    }

    const passwordHashString = await this.passwordHasher.hash(command.password);
    const passwordHash = AdminPasswordHash.create(passwordHashString);

    const newAdmin = AdminUser.create({
      email,
      passwordHash,
      firstName: command.firstName,
      lastName: command.lastName,
      role: targetRole,
      phoneNumber: command.phoneNumber,
      avatarUrl: command.avatarUrl,
      mustChangePassword: command.mustChangePassword,
      createdBy: operator.id,
    });

    await this.adminRepo.save(newAdmin);

    await this.auditPort.recordLog({
      adminId: operator.id.value,
      action: 'STAFF_CREATED',
      targetId: newAdmin.id.value,
      details: {
        email: newAdmin.email.value,
        role: newAdmin.role.value,
        mustChangePassword: newAdmin.mustChangePassword,
      },
    });

    return {
      id: newAdmin.id.value,
      email: newAdmin.email.value,
      firstName: newAdmin.firstName,
      lastName: newAdmin.lastName,
      fullName: newAdmin.fullName,
      role: newAdmin.role.value,
      phoneNumber: newAdmin.phoneNumber,
      avatarUrl: newAdmin.avatarUrl,
      isActive: newAdmin.isActive,
      mustChangePassword: newAdmin.mustChangePassword,
      createdAt: newAdmin.createdAt,
    };
  }
}
