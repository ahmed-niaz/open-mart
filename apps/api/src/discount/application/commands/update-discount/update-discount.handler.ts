import { Inject } from '@nestjs/common';
import { CommandHandler, EventPublisher, ICommandHandler } from '@nestjs/cqrs';

import { UpdateDiscountCommand } from './update-discount.command.js';
import {
  DISCOUNT_REPOSITORY_PORT,
  type DiscountRepositoryPort,
} from '../../ports/discount.repository.port.js';
import { DiscountCode } from '../../../domain/value-objects/discount-code.vo.js';
import { DiscountValue } from '../../../domain/value-objects/discount-value.vo.js';
import { DiscountScopeVO } from '../../../domain/value-objects/discount-scope.vo.js';
import {
  ApplicationException,
  ApplicationExceptionCode,
} from '../../../../shared/domain/exceptions/application.exception.js';
import {
  DRIZZLE,
  type DrizzleDB,
} from '../../../../shared/infrastructure/database/postgres/drizzle.provider.js';
import { adminAuditLogsSchema } from '../../../../shared/infrastructure/database/postgres/schema/admin.schema.js';

@CommandHandler(UpdateDiscountCommand)
export class UpdateDiscountCommandHandler implements ICommandHandler<
  UpdateDiscountCommand,
  void
> {
  constructor(
    @Inject(DISCOUNT_REPOSITORY_PORT)
    private readonly discountRepo: DiscountRepositoryPort,
    @Inject(DRIZZLE) private readonly db: DrizzleDB,
    private readonly publisher: EventPublisher,
  ) {}

  async execute(command: UpdateDiscountCommand): Promise<void> {
    const discount = await this.discountRepo.findById(command.id);
    if (!discount) {
      throw new ApplicationException(
        'Discount not found.',
        ApplicationExceptionCode.NOT_FOUND,
      );
    }

    let codeVO: DiscountCode | undefined;
    if (command.code) {
      codeVO = DiscountCode.create(command.code);
      if (!codeVO.equals(discount.code)) {
        const existing = await this.discountRepo.findByCode(codeVO.value);
        if (existing && existing.id.value !== discount.id.value) {
          throw new ApplicationException(
            `Discount code '${codeVO.value}' already exists.`,
            ApplicationExceptionCode.CONFLICT,
          );
        }
      }
    }

    let valueVO: DiscountValue | undefined;
    if (command.type || command.value !== undefined) {
      const type = command.type || discount.value.type;
      if (type === 'percentage') {
        valueVO = DiscountValue.percentage(
          command.value ?? discount.value.rawValue!,
        );
      } else if (type === 'fixed_amount') {
        valueVO = DiscountValue.fixedAmount(
          command.value ?? discount.value.rawValue!,
        );
      } else {
        valueVO = DiscountValue.freeShipping();
      }
    }

    let scopeVO: DiscountScopeVO | undefined;
    if (
      command.scope ||
      command.targetProductIds ||
      command.targetCategoryIds
    ) {
      const scopeType = command.scope || discount.scope.scope;
      if (scopeType === 'specific_products') {
        scopeVO = DiscountScopeVO.specificProducts(
          command.targetProductIds || discount.scope.targetProductIds,
        );
      } else if (scopeType === 'specific_categories') {
        scopeVO = DiscountScopeVO.specificCategories(
          command.targetCategoryIds || discount.scope.targetCategoryIds,
        );
      } else {
        scopeVO = DiscountScopeVO.allProducts();
      }
    }

    const boundDiscount = this.publisher.mergeObjectContext(discount);

    boundDiscount.update({
      name: command.name,
      description: command.description,
      code: codeVO,
      value: valueVO,
      scope: scopeVO,
      customerEligibility: command.customerEligibility,
      excludeSaleItems: command.excludeSaleItems,
      minOrderAmount: command.minOrderAmount,
      maxDiscountAmount: command.maxDiscountAmount,
      maxUsageLimit: command.maxUsageLimit,
      maxUsagePerCustomer: command.maxUsagePerCustomer,
      startsAt: command.startsAt,
      expiresAt: command.expiresAt,
      updatedBy: command.updatedBy,
    });

    await this.discountRepo.save(boundDiscount);
    boundDiscount.commit();

    // Audit log
    if (command.updatedBy) {
      await this.db.insert(adminAuditLogsSchema).values({
        adminId: command.updatedBy,
        action: 'discount:updated',
        targetId: discount.id.value,
        details: {
          code: discount.code.value,
          name: discount.name,
        },
        ipAddress: command.ipAddress,
        userAgent: command.userAgent,
      });
    }
  }
}
