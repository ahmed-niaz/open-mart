import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';

import { ConfirmOrderCommand } from '../application/use-cases/confirm-order/confirm-order.command.js';
import { ProcessOrderCommand } from '../application/use-cases/process-order/process-order.command.js';
import { ShipOrderCommand } from '../application/use-cases/ship-order/ship-order.command.js';
import { DeliverOrderCommand } from '../application/use-cases/deliver-order/deliver-order.command.js';
import { ReturnOrderCommand } from '../application/use-cases/return-order/return-order.command.js';
import { CancelOrderCommand } from '../application/use-cases/cancel-order/cancel-order.command.js';
import { GetOrderByIdQuery } from '../application/queries/get-order-by-id/get-order-by-id.query.js';
import { ListOrdersQuery } from '../application/queries/list-orders/list-orders.query.js';
import { ShipOrderDto } from './dto/ship-order.dto.js';
import { CancelOrderDto } from './dto/cancel-order.dto.js';
import { ReturnOrderDto } from './dto/return-order.dto.js';
import { ListOrderQueryDto } from './dto/list-order-query.dto.js';
import { AdminJwtGuard } from '../../shared/infrastructure/guards/admin-jwt.guard.js';
import { PermissionsGuard } from '../../shared/infrastructure/guards/permissions.guard.js';
import { RequirePermissions } from '../../shared/presentation/decorators/require-permissions.decorator.js';
import { CurrentAdmin } from '../../shared/presentation/decorators/current-admin.decorator.js';
import { AdminPermission } from '../../shared/infrastructure/guards/admin-permissions.js';
import type { AuthenticatedUser } from '../../shared/presentation/interfaces/authenticated-user.interface.js';
import {
  ApplicationException,
  ApplicationExceptionCode,
} from '../../shared/domain/exceptions/application.exception.js';

@Controller('admin/orders')
@UseGuards(AdminJwtGuard, PermissionsGuard)
export class OrderAdminController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
  ) {}

  /**
   * GET /api/admin/orders
   * Paginated list of orders with filters.
   */
  @Get()
  @RequirePermissions(AdminPermission.ORDERS_READ)
  async list(@Query() query: ListOrderQueryDto) {
    return this.queryBus.execute(
      new ListOrdersQuery(
        query.page,
        query.limit,
        query.status,
        query.customerId,
      ),
    );
  }

  /**
   * GET /api/admin/orders/:id
   * Admin details view of any order.
   */
  @Get(':id')
  @RequirePermissions(AdminPermission.ORDERS_READ)
  async getById(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentAdmin() admin: AuthenticatedUser,
  ) {
    const result = await this.queryBus.execute(
      new GetOrderByIdQuery(id, admin.id, true),
    );
    return { data: result };
  }

  /**
   * PATCH /api/admin/orders/:id/confirm
   * Manual confirmation (e.g. cash on delivery).
   */
  @Patch(':id/confirm')
  @RequirePermissions(AdminPermission.ORDERS_FULFILL)
  async confirm(@Param('id', ParseUUIDPipe) id: string) {
    const result = await this.commandBus.execute(new ConfirmOrderCommand(id));
    return { data: result };
  }

  /**
   * PATCH /api/admin/orders/:id/process
   * Transition: confirmed -> processing.
   */
  @Patch(':id/process')
  @RequirePermissions(AdminPermission.ORDERS_FULFILL)
  async process(@Param('id', ParseUUIDPipe) id: string) {
    const result = await this.commandBus.execute(new ProcessOrderCommand(id));
    return { data: result };
  }

  /**
   * PATCH /api/admin/orders/:id/ship
   * Transition: processing -> shipped.
   */
  @Patch(':id/ship')
  @RequirePermissions(AdminPermission.ORDERS_FULFILL)
  async ship(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ShipOrderDto,
  ) {
    const result = await this.commandBus.execute(
      new ShipOrderCommand(id, dto.trackingNumber, dto.courierName),
    );
    return { data: result };
  }

  /**
   * PATCH /api/admin/orders/:id/deliver
   * Transition: shipped -> delivered.
   */
  @Patch(':id/deliver')
  @RequirePermissions(AdminPermission.ORDERS_FULFILL)
  async deliver(@Param('id', ParseUUIDPipe) id: string) {
    const result = await this.commandBus.execute(new DeliverOrderCommand(id));
    return { data: result };
  }

  /**
   * PATCH /api/admin/orders/:id/cancel
   * Support role policy: Support can only cancel pending or confirmed orders.
   */
  @Patch(':id/cancel')
  @RequirePermissions(AdminPermission.ORDERS_CANCEL)
  async cancel(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CancelOrderDto,
    @CurrentAdmin() admin: AuthenticatedUser,
  ) {
    // Concrete Support Role Policy Check
    if (admin.role === 'support') {
      const order = await this.queryBus.execute(
        new GetOrderByIdQuery(id, admin.id, true),
      );
      if (!order) {
        throw new ApplicationException(
          'Order not found.',
          ApplicationExceptionCode.NOT_FOUND,
        );
      }
      if (order.status !== 'pending' && order.status !== 'confirmed') {
        throw new ApplicationException(
          `Customer support can only cancel orders in 'pending' or 'confirmed' status. Current status: ${order.status}.`,
          ApplicationExceptionCode.FORBIDDEN,
        );
      }
    }

    const result = await this.commandBus.execute(
      new CancelOrderCommand(id, dto.reason),
    );
    return { data: result };
  }

  /**
   * PATCH /api/admin/orders/:id/return
   * Support role policy: Support can only return delivered orders within 30 days.
   */
  @Patch(':id/return')
  @RequirePermissions(AdminPermission.ORDERS_RETURN)
  async markReturned(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReturnOrderDto,
    @CurrentAdmin() admin: AuthenticatedUser,
  ) {
    // Concrete Support Role Policy Check
    if (admin.role === 'support') {
      const order = await this.queryBus.execute(
        new GetOrderByIdQuery(id, admin.id, true),
      );
      if (!order) {
        throw new ApplicationException(
          'Order not found.',
          ApplicationExceptionCode.NOT_FOUND,
        );
      }
      if (order.status !== 'delivered' && order.status !== 'shipped') {
        throw new ApplicationException(
          `Customer support can only initiate returns on 'shipped' or 'delivered' orders. Current status: ${order.status}.`,
          ApplicationExceptionCode.FORBIDDEN,
        );
      }
      if (order.deliveredAt) {
        const daysSinceDelivery =
          (Date.now() - new Date(order.deliveredAt).getTime()) /
          (1000 * 60 * 60 * 24);
        if (daysSinceDelivery > 30) {
          throw new ApplicationException(
            'Return window expired. Orders delivered more than 30 days ago cannot be returned by support.',
            ApplicationExceptionCode.FORBIDDEN,
          );
        }
      }
    }

    const result = await this.commandBus.execute(
      new ReturnOrderCommand(id, dto.reason),
    );
    return { data: result };
  }
}
