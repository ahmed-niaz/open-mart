import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { Throttle } from '@nestjs/throttler';

import { PlaceOrderCommand } from '../application/use-cases/place-order/place-order.command.js';
import { ConfirmOrderCommand } from '../application/use-cases/confirm-order/confirm-order.command.js';
import { ProcessOrderCommand } from '../application/use-cases/process-order/process-order.command.js';
import { ShipOrderCommand } from '../application/use-cases/ship-order/ship-order.command.js';
import { DeliverOrderCommand } from '../application/use-cases/deliver-order/deliver-order.command.js';
import { ReturnOrderCommand } from '../application/use-cases/return-order/return-order.command.js';
import { CancelOrderCommand } from '../application/use-cases/cancel-order/cancel-order.command.js';
import { GetOrderByIdQuery } from '../application/queries/get-order-by-id/get-order-by-id.query.js';
import { ListCustomerOrdersQuery } from '../application/queries/list-customer-orders/list-customer-orders.query.js';
import { ListOrdersQuery } from '../application/queries/list-orders/list-orders.query.js';
import { TrackOrderQuery } from '../application/queries/track-order/track-order.query.js';
import { CreateOrderDto } from './dto/create-order.dto.js';
import { ShipOrderDto } from './dto/ship-order.dto.js';
import { CancelOrderDto } from './dto/cancel-order.dto.js';
import { ReturnOrderDto } from './dto/return-order.dto.js';
import { TrackOrderQueryDto } from './dto/track-order-query.dto.js';
import { ListOrderQueryDto } from './dto/list-order-query.dto.js';
import {
  JwtAuthGuard,
  type AuthenticatedUser,
} from '../../customer/presentation/guards/jwt-auth.guard.js';
import { OptionalJwtAuthGuard } from '../../shared/infrastructure/guards/optional-jwt-auth.guard.js';
import { AdminGuard } from '../../shared/infrastructure/guards/admin.guard.js';
import { CurrentUser } from '../../customer/presentation/decorators/current-user.decorator.js';

@Controller('orders')
export class OrderController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
  ) {}

  // ---------------------------------------------------------------------------
  // Customer / guest endpoints
  // ---------------------------------------------------------------------------

  /**
   * POST /api/orders
   * Place a new order (guest or authenticated).
   * Requires header: X-Idempotency-Key
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(OptionalJwtAuthGuard)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  async placeOrder(
    @Body() dto: CreateOrderDto,
    @Headers('x-idempotency-key') idempotencyKey: string | undefined,
    @CurrentUser() user?: AuthenticatedUser,
  ) {
    const key = idempotencyKey?.trim();
    if (!key || key.length < 8 || key.length > 128) {
      throw new BadRequestException(
        'X-Idempotency-Key header is required (8-128 characters)',
      );
    }

    // Guests must identify themselves and name the recipient.
    if (!user) {
      if (!dto.customer) {
        throw new BadRequestException(
          'customer (email and name) is required for guest checkout',
        );
      }
      if (!dto.shippingAddress.recipientName) {
        throw new BadRequestException(
          'shippingAddress.recipientName is required for guest checkout',
        );
      }
    }

    const result = await this.commandBus.execute(
      new PlaceOrderCommand(
        user?.id ?? null,
        dto.items, // productId + quantity only; prices are resolved server-side
        dto.shippingAddress,
        key,
        user ? null : (dto.customer ?? null),
        dto.notes,
      ),
    );
    return { data: result };
  }

  /**
   * GET /api/orders/my-orders
   * Authenticated customer's order history.
   * NOTE: static routes (my-orders, track) must be declared before :id.
   */
  @Get('my-orders')
  @UseGuards(JwtAuthGuard)
  async getMyOrders(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ListOrderQueryDto,
  ) {
    return this.queryBus.execute(
      new ListCustomerOrdersQuery(
        user.id,
        query.page,
        query.limit,
        query.status,
      ),
    );
  }

  /**
   * GET /api/orders/track?orderNumber=ORD-...&phone=01XXXXXXXXX
   * Public guest tracking. Handler must return a minimal view (status, tracking, courier)
   * and the same generic 404 for "not found" and "phone mismatch".
   */
  @Get('track')
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  async track(@Query() query: TrackOrderQueryDto) {
    const result = await this.queryBus.execute(
      new TrackOrderQuery(query.orderNumber, query.phone),
    );
    return { data: result };
  }

  /**
   * GET /api/orders/:id
   * Customers can read only their own order; admins can read any (checked in the query handler).
   */
  @Get(':id')
  @UseGuards(JwtAuthGuard)
  async getById(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const isAdmin = user.scope === 'admin';
    const result = await this.queryBus.execute(
      new GetOrderByIdQuery(id, user.id, isAdmin),
    );
    return { data: result };
  }

  /**
   * PATCH /api/orders/:id/cancel
   * Customer: only own order, only while pending/confirmed (enforced in handler).
   * Admin: any order up to processing.
   */
  @Patch(':id/cancel')
  @UseGuards(JwtAuthGuard)
  async cancel(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CancelOrderDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const requestingCustomerId = user.scope === 'admin' ? undefined : user.id;
    const result = await this.commandBus.execute(
      new CancelOrderCommand(id, dto.reason, requestingCustomerId),
    );
    return { data: result };
  }

  // ---------------------------------------------------------------------------
  // Admin endpoints (JwtAuthGuard first, then AdminGuard)
  // ---------------------------------------------------------------------------

  /**
   * GET /api/orders
   * Admin paginated list with optional filters.
   */
  @Get()
  @UseGuards(JwtAuthGuard, AdminGuard)
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
   * PATCH /api/orders/:id/confirm      pending -> confirmed
   * Manual confirmation (e.g. cash on delivery after a phone call).
   * For online payments the saga confirms on PaymentCompleted. Handler must be idempotent.
   */
  @Patch(':id/confirm')
  @UseGuards(JwtAuthGuard, AdminGuard)
  async confirm(@Param('id', ParseUUIDPipe) id: string) {
    const result = await this.commandBus.execute(new ConfirmOrderCommand(id));
    return { data: result };
  }

  /** PATCH /api/orders/:id/process      confirmed -> processing */
  @Patch(':id/process')
  @UseGuards(JwtAuthGuard, AdminGuard)
  async process(@Param('id', ParseUUIDPipe) id: string) {
    const result = await this.commandBus.execute(new ProcessOrderCommand(id));
    return { data: result };
  }

  /** PATCH /api/orders/:id/ship         processing -> shipped (courier + tracking number) */
  @Patch(':id/ship')
  @UseGuards(JwtAuthGuard, AdminGuard)
  async ship(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ShipOrderDto,
  ) {
    const result = await this.commandBus.execute(
      new ShipOrderCommand(id, dto.trackingNumber, dto.courierName),
    );
    return { data: result };
  }

  /** PATCH /api/orders/:id/deliver      shipped -> delivered */
  @Patch(':id/deliver')
  @UseGuards(JwtAuthGuard, AdminGuard)
  async deliver(@Param('id', ParseUUIDPipe) id: string) {
    const result = await this.commandBus.execute(new DeliverOrderCommand(id));
    return { data: result };
  }

  /** PATCH /api/orders/:id/return       shipped -> returned (failed / refused delivery) */
  @Patch(':id/return')
  @UseGuards(JwtAuthGuard, AdminGuard)
  async markReturned(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReturnOrderDto,
  ) {
    const result = await this.commandBus.execute(
      new ReturnOrderCommand(id, dto.reason),
    );
    return { data: result };
  }
}
