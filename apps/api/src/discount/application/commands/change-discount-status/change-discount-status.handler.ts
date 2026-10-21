import { Inject } from '@nestjs/common';
import { CommandHandler, EventPublisher, ICommandHandler } from '@nestjs/cqrs';

import { ChangeDiscountStatusCommand } from './change-discount-status.command.js';
import {
  DISCOUNT_REPOSITORY_PORT,
  type DiscountRepositoryPort,
} from '../../ports/discount.repository.port.js';
import {
  AdminPermission,
  ROLE_PERMISSIONS_MAP,
  type AdminRole,
} from '../../../../shared/infrastructure/guards/admin-permissions.js';
import {
  ApplicationException,
  ApplicationExceptionCode,
} from '../../../../shared/domain/exceptions/application.exception.js';
import {
  DRIZZLE,
  type DrizzleDB,
} from '../../../../shared/infrastructure/database/postgres/drizzle.provider.js';
import { adminAuditLogsSchema } from '../../../../shared/infrastructure/database/postgres/schema/admin.schema.js';

@CommandHandler(ChangeDiscountStatusCommand)
export class ChangeDiscountStatusCommandHandler implements ICommandHandler<
  ChangeDiscountStatusCommand,
  void
> {
  constructor(
    @Inject(DISCOUNT_REPOSITORY_PORT)
    private readonly discountRepo: DiscountRepositoryPort,
    @Inject(DRIZZLE) private readonly db: DrizzleDB,
    private readonly publisher: EventPublisher,
  ) {}

  async execute(command: ChangeDiscountStatusCommand): Promise<void> {
    const discount = await this.discountRepo.findById(command.id);
    if (!discount) {
      throw new ApplicationException(
        'Discount not found.',
        ApplicationExceptionCode.NOT_FOUND,
      );
    }

    // RBAC GUARD: Archiving permanently retires a discount and requires DISCOUNTS_DELETE permission!
    if (command.status === 'archived') {
      const role = (command.userRole as AdminRole) || 'manager';
      const perms = ROLE_PERMISSIONS_MAP[role] || new Set();
      if (!perms.has(AdminPermission.DISCOUNTS_DELETE)) {
        throw new ApplicationException(
          'Insufficient permissions. Only administrators can archive discounts.',
          ApplicationExceptionCode.FORBIDDEN,
        );
      }
    }

    const boundDiscount = this.publisher.mergeObjectContext(discount);

    if (command.status === 'active') {
      boundDiscount.activate(command.updatedBy);
    } else if (command.status === 'paused') {
      boundDiscount.pause(command.updatedBy);
    } else if (command.status === 'archived') {
      boundDiscount.archive(command.updatedBy);
    } else {
      throw new ApplicationException(
        `Invalid target status '${command.status}'. Allowed transitions: active, paused, archived.`,
        ApplicationExceptionCode.VALIDATION_ERROR,
      );
    }

    await this.discountRepo.save(boundDiscount);
    boundDiscount.commit();

    // Audit log
    if (command.updatedBy) {
      await this.db.insert(adminAuditLogsSchema).values({
        adminId: command.updatedBy,
        action: `discount:status:${command.status}`,
        targetId: discount.id.value,
        details: {
          code: discount.code.value,
          newStatus: command.status,
        },
        ipAddress: command.ipAddress,
        userAgent: command.userAgent,
      });
    }
  }
}
