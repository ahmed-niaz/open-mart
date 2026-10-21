import { Inject } from '@nestjs/common';
import { CommandHandler, EventPublisher, ICommandHandler } from '@nestjs/cqrs';

import { CreateDiscountCommand } from './create-discount.command.js';
import {
  DISCOUNT_REPOSITORY_PORT,
  type DiscountRepositoryPort,
} from '../../ports/discount.repository.port.js';
import { Discount } from '../../../domain/entities/discount.entity.js';
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

@CommandHandler(CreateDiscountCommand)
export class CreateDiscountCommandHandler implements ICommandHandler<
  CreateDiscountCommand,
  { id: string }
> {
  constructor(
    @Inject(DISCOUNT_REPOSITORY_PORT)
    private readonly discountRepo: DiscountRepositoryPort,
    @Inject(DRIZZLE) private readonly db: DrizzleDB,
    private readonly publisher: EventPublisher,
  ) {}

  async execute(command: CreateDiscountCommand): Promise<{ id: string }> {
    const codeVO = DiscountCode.create(command.code);

    const existing = await this.discountRepo.findByCode(codeVO.value);
    if (existing) {
      throw new ApplicationException(
        `Discount code '${codeVO.value}' already exists.`,
        ApplicationExceptionCode.CONFLICT,
      );
    }

    let valueVO: DiscountValue;
    if (command.type === 'percentage') {
      if (!command.value) {
        throw new ApplicationException(
          'Percentage value (in basis points) is required for percentage discounts.',
          ApplicationExceptionCode.VALIDATION_ERROR,
        );
      }
      valueVO = DiscountValue.percentage(command.value);
    } else if (command.type === 'fixed_amount') {
      if (!command.value) {
        throw new ApplicationException(
          'Amount (in poisha) is required for fixed_amount discounts.',
          ApplicationExceptionCode.VALIDATION_ERROR,
        );
      }
      valueVO = DiscountValue.fixedAmount(command.value);
    } else {
      valueVO = DiscountValue.freeShipping();
    }

    let scopeVO: DiscountScopeVO;
    if (command.scope === 'specific_products') {
      scopeVO = DiscountScopeVO.specificProducts(command.targetProductIds);
    } else if (command.scope === 'specific_categories') {
      scopeVO = DiscountScopeVO.specificCategories(command.targetCategoryIds);
    } else {
      scopeVO = DiscountScopeVO.allProducts();
    }

    const discount = this.publisher.mergeObjectContext(
      Discount.create({
        code: codeVO,
        name: command.name,
        description: command.description,
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
        createdBy: command.createdBy,
      }),
    );

    await this.discountRepo.save(discount);
    discount.commit();

    // Audit log
    if (command.createdBy) {
      await this.db.insert(adminAuditLogsSchema).values({
        adminId: command.createdBy,
        action: 'discount:created',
        targetId: discount.id.value,
        details: {
          code: discount.code.value,
          name: discount.name,
          type: discount.value.type,
        },
        ipAddress: command.ipAddress,
        userAgent: command.userAgent,
      });
    }

    return { id: discount.id.value };
  }
}
