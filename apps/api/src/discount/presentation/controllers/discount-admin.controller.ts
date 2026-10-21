import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import type { Request } from 'express';

import { AdminJwtGuard } from '../../../shared/infrastructure/guards/admin-jwt.guard.js';
import { PermissionsGuard } from '../../../shared/infrastructure/guards/permissions.guard.js';
import { RequirePermissions } from '../../../shared/presentation/decorators/require-permissions.decorator.js';
import { CurrentAdmin } from '../../../shared/presentation/decorators/current-admin.decorator.js';
import { AdminPermission } from '../../../shared/infrastructure/guards/admin-permissions.js';
import type { AuthenticatedUser } from '../../../shared/presentation/interfaces/authenticated-user.interface.js';

import { CreateDiscountCommand } from '../../application/commands/create-discount/create-discount.command.js';
import { UpdateDiscountCommand } from '../../application/commands/update-discount/update-discount.command.js';
import { ChangeDiscountStatusCommand } from '../../application/commands/change-discount-status/change-discount-status.command.js';
import { GetDiscountByIdQuery } from '../../application/queries/get-discount-by-id/get-discount-by-id.query.js';
import { ListDiscountsQuery } from '../../application/queries/list-discounts/list-discounts.query.js';
import { ListDiscountRedemptionsQuery } from '../../application/queries/list-discount-redemptions/list-discount-redemptions.query.js';

import { CreateDiscountDto } from '../dto/create-discount.dto.js';
import { UpdateDiscountDto } from '../dto/update-discount.dto.js';
import { ChangeDiscountStatusDto } from '../dto/change-discount-status.dto.js';
import { ListDiscountsQueryDto } from '../dto/list-discounts-query.dto.js';
import { ListRedemptionsQueryDto } from '../dto/list-redemptions-query.dto.js';

@Controller('admin/discounts')
@UseGuards(AdminJwtGuard, PermissionsGuard)
export class DiscountAdminController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
  ) {}

  /**
   * POST /api/admin/discounts
   * Create a new discount campaign.
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @RequirePermissions(AdminPermission.DISCOUNTS_WRITE)
  async create(
    @Body() dto: CreateDiscountDto,
    @CurrentAdmin() admin: AuthenticatedUser,
    @Req() req: Request,
  ) {
    const result = await this.commandBus.execute(
      new CreateDiscountCommand(
        dto.code,
        dto.name || dto.code,
        dto.type,
        dto.value,
        dto.scope || 'all_products',
        dto.targetProductIds || [],
        dto.targetCategoryIds || [],
        dto.customerEligibility || 'all',
        dto.excludeSaleItems ?? false,
        dto.minOrderAmount ?? 0,
        dto.maxDiscountAmount,
        dto.maxUsageLimit,
        dto.maxUsagePerCustomer ?? 1,
        dto.startsAt ? new Date(dto.startsAt) : undefined,
        dto.expiresAt ? new Date(dto.expiresAt) : undefined,
        dto.description,
        admin.id,
        req.ip,
        req.headers['user-agent'],
      ),
    );
    return { data: result };
  }

  /**
   * GET /api/admin/discounts
   * Paginated list of discount campaigns.
   */
  @Get()
  @RequirePermissions(AdminPermission.DISCOUNTS_READ)
  async list(@Query() query: ListDiscountsQueryDto) {
    const result = await this.queryBus.execute(
      new ListDiscountsQuery(
        query.page,
        query.limit,
        query.status,
        query.type,
        query.search,
      ),
    );
    return result;
  }

  /**
   * GET /api/admin/discounts/:id
   * Get single discount campaign details.
   */
  @Get(':id')
  @RequirePermissions(AdminPermission.DISCOUNTS_READ)
  async getById(@Param('id', ParseUUIDPipe) id: string) {
    const result = await this.queryBus.execute(new GetDiscountByIdQuery(id));
    return { data: result };
  }

  /**
   * PUT /api/admin/discounts/:id
   * Update discount campaign details.
   */
  @Put(':id')
  @RequirePermissions(AdminPermission.DISCOUNTS_WRITE)
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateDiscountDto,
    @CurrentAdmin() admin: AuthenticatedUser,
    @Req() req: Request,
  ) {
    const result = await this.commandBus.execute(
      new UpdateDiscountCommand(
        id,
        dto.name,
        dto.description,
        dto.code,
        dto.type,
        dto.value,
        dto.scope,
        dto.targetProductIds,
        dto.targetCategoryIds,
        dto.customerEligibility,
        dto.excludeSaleItems,
        dto.minOrderAmount,
        dto.maxDiscountAmount,
        dto.maxUsageLimit,
        dto.maxUsagePerCustomer,
        dto.startsAt ? new Date(dto.startsAt) : undefined,
        dto.expiresAt ? new Date(dto.expiresAt) : undefined,
        admin.id,
        req.ip,
        req.headers['user-agent'],
      ),
    );
    return { data: result };
  }

  /**
   * PATCH /api/admin/discounts/:id/status
   * Transition discount status ('active', 'paused', 'archived').
   * Note: 'archived' requires DISCOUNTS_DELETE permission.
   */
  @Patch(':id/status')
  @RequirePermissions(AdminPermission.DISCOUNTS_WRITE)
  async changeStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ChangeDiscountStatusDto,
    @CurrentAdmin() admin: AuthenticatedUser,
    @Req() req: Request,
  ) {
    await this.commandBus.execute(
      new ChangeDiscountStatusCommand(
        id,
        dto.status,
        admin.id,
        admin.role,
        req.ip,
        req.headers['user-agent'],
      ),
    );
    return {
      message: `Discount status successfully changed to ${dto.status}.`,
    };
  }

  /**
   * GET /api/admin/discounts/:id/redemptions
   * View redemption ledger history for a discount.
   */
  @Get(':id/redemptions')
  @RequirePermissions(AdminPermission.DISCOUNTS_READ)
  async listRedemptions(
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: ListRedemptionsQueryDto,
  ) {
    const result = await this.queryBus.execute(
      new ListDiscountRedemptionsQuery(id, query.page, query.limit),
    );
    return result;
  }
}
