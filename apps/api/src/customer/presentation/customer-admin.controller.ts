import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';

import { ListAdminCustomersQuery } from '../application/queries/list-admin-customers/list-admin-customers.query.js';
import { GetAdminCustomerDetailsQuery } from '../application/queries/get-admin-customer-details/get-admin-customer-details.query.js';
import { ActivateCustomerCommand } from '../application/use-cases/activate-customer/activate-customer.command.js';
import { DeactivateCustomerCommand } from '../application/use-cases/deactivate-customer/deactivate-customer.command.js';
import { ListCustomerQueryDto } from './dto/list-customer-query.dto.js';
import { AdminJwtGuard } from '../../shared/infrastructure/guards/admin-jwt.guard.js';
import { PermissionsGuard } from '../../shared/infrastructure/guards/permissions.guard.js';
import { RequirePermissions } from '../../shared/presentation/decorators/require-permissions.decorator.js';
import { AdminPermission } from '../../shared/infrastructure/guards/admin-permissions.js';

@Controller('admin/customers')
@UseGuards(AdminJwtGuard, PermissionsGuard)
export class CustomerAdminController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
  ) {}

  /**
   * GET /api/admin/customers
   * Paginated list of customers with aggregated metrics (total orders, total spend, last order date).
   */
  @Get()
  @RequirePermissions(AdminPermission.CUSTOMERS_READ)
  async list(@Query() query: ListCustomerQueryDto) {
    return this.queryBus.execute(
      new ListAdminCustomersQuery(
        query.page,
        query.limit,
        query.search,
        query.isActive,
      ),
    );
  }

  /**
   * GET /api/admin/customers/:id
   * Complete customer details: profile, lifetime value, delivery addresses, recent orders.
   */
  @Get(':id')
  @RequirePermissions(AdminPermission.CUSTOMERS_READ)
  async getById(@Param('id', ParseUUIDPipe) id: string) {
    const data = await this.queryBus.execute(
      new GetAdminCustomerDetailsQuery(id),
    );
    return { data };
  }

  /**
   * PATCH /api/admin/customers/:id/activate
   * Reactivates a deactivated customer account.
   */
  @Patch(':id/activate')
  @RequirePermissions(AdminPermission.CUSTOMERS_DEACTIVATE)
  @HttpCode(HttpStatus.OK)
  async activate(@Param('id', ParseUUIDPipe) id: string) {
    await this.commandBus.execute(new ActivateCustomerCommand(id));
    return { data: { message: 'Customer account activated successfully' } };
  }

  /**
   * PATCH /api/admin/customers/:id/deactivate
   * Deactivates/suspends a customer account.
   */
  @Patch(':id/deactivate')
  @RequirePermissions(AdminPermission.CUSTOMERS_DEACTIVATE)
  @HttpCode(HttpStatus.OK)
  async deactivate(@Param('id', ParseUUIDPipe) id: string) {
    await this.commandBus.execute(new DeactivateCustomerCommand(id));
    return { data: { message: 'Customer account deactivated successfully' } };
  }
}
