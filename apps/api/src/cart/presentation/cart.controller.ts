import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import type { Request } from 'express';

import { OptionalJwtAuthGuard } from '../../shared/infrastructure/guards/optional-jwt-auth.guard.js';
import type { AuthenticatedUser } from '../../shared/presentation/interfaces/authenticated-user.interface.js';
import { AddCartItemDto } from './dto/add-cart-item.dto.js';
import { UpdateCartItemDto } from './dto/update-cart-item.dto.js';
import { MergeCartDto } from './dto/merge-cart.dto.js';
import { AddItemToCartCommand } from '../application/commands/add-item-to-cart/add-item-to-cart.command.js';
import { UpdateCartItemQuantityCommand } from '../application/commands/update-cart-item-quantity/update-cart-item-quantity.command.js';
import { RemoveItemFromCartCommand } from '../application/commands/remove-item-from-cart/remove-item-from-cart.command.js';
import { ClearCartCommand } from '../application/commands/clear-cart/clear-cart.command.js';
import { MergeCartCommand } from '../application/commands/merge-cart/merge-cart.command.js';
import { GetCartQuery } from '../application/queries/get-cart/get-cart.query.js';

@Controller('cart')
@UseGuards(OptionalJwtAuthGuard)
export class CartController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
  ) {}

  private resolveSession(
    req: Request,
    headerGuestId?: string,
  ): { customerId: string | null; guestId: string | null } {
    const user = (req as any).user as AuthenticatedUser | undefined;
    const customerId = user?.id || null;
    const guestId =
      headerGuestId?.trim() ||
      (req.headers['x-guest-id'] as string)?.trim() ||
      null;

    if (!customerId && !guestId) {
      throw new BadRequestException(
        'Either an authenticated customer session or X-Guest-ID header is required to access the cart',
      );
    }

    return { customerId, guestId };
  }

  /**
   * GET /api/cart
   * Retrieve active cart with live catalog prices, thumbnails, and availability status.
   */
  @Get()
  async getCart(
    @Req() req: Request,
    @Headers('x-guest-id') guestIdHeader?: string,
  ) {
    const { customerId, guestId } = this.resolveSession(req, guestIdHeader);
    const cart = await this.queryBus.execute(
      new GetCartQuery(customerId, guestId),
    );
    return { data: cart };
  }

  /**
   * POST /api/cart/items
   * Add a product to the active cart.
   */
  @Post('items')
  @HttpCode(HttpStatus.OK)
  async addItem(
    @Body() dto: AddCartItemDto,
    @Req() req: Request,
    @Headers('x-guest-id') guestIdHeader?: string,
  ) {
    const { customerId, guestId } = this.resolveSession(req, guestIdHeader);

    await this.commandBus.execute(
      new AddItemToCartCommand(
        dto.productId,
        dto.quantity,
        customerId,
        guestId,
      ),
    );

    const updated = await this.queryBus.execute(
      new GetCartQuery(customerId, guestId),
    );
    return { data: updated };
  }

  /**
   * PATCH /api/cart/items/:productId
   * Set specific quantity for a cart item (setting quantity to 0 removes the item).
   */
  @Patch('items/:productId')
  async updateQuantity(
    @Param('productId', new ParseUUIDPipe()) productId: string,
    @Body() dto: UpdateCartItemDto,
    @Req() req: Request,
    @Headers('x-guest-id') guestIdHeader?: string,
  ) {
    const { customerId, guestId } = this.resolveSession(req, guestIdHeader);

    await this.commandBus.execute(
      new UpdateCartItemQuantityCommand(
        productId,
        dto.quantity,
        customerId,
        guestId,
      ),
    );

    const updated = await this.queryBus.execute(
      new GetCartQuery(customerId, guestId),
    );
    return { data: updated };
  }

  /**
   * DELETE /api/cart/items/:productId
   * Remove a single product item from the active cart.
   */
  @Delete('items/:productId')
  async removeItem(
    @Param('productId', new ParseUUIDPipe()) productId: string,
    @Req() req: Request,
    @Headers('x-guest-id') guestIdHeader?: string,
  ) {
    const { customerId, guestId } = this.resolveSession(req, guestIdHeader);

    await this.commandBus.execute(
      new RemoveItemFromCartCommand(productId, customerId, guestId),
    );

    const updated = await this.queryBus.execute(
      new GetCartQuery(customerId, guestId),
    );
    return { data: updated };
  }

  /**
   * DELETE /api/cart
   * Clear all items in the active cart.
   */
  @Delete()
  async clearCart(
    @Req() req: Request,
    @Headers('x-guest-id') guestIdHeader?: string,
  ) {
    const { customerId, guestId } = this.resolveSession(req, guestIdHeader);

    await this.commandBus.execute(new ClearCartCommand(customerId, guestId));

    const updated = await this.queryBus.execute(
      new GetCartQuery(customerId, guestId),
    );
    return { data: updated };
  }

  /**
   * POST /api/cart/merge
   * Merge anonymous guest cart into the authenticated customer cart upon login.
   */
  @Post('merge')
  @HttpCode(HttpStatus.OK)
  async mergeCart(@Body() dto: MergeCartDto, @Req() req: Request) {
    const user = (req as any).user as AuthenticatedUser | undefined;
    if (!user?.id) {
      throw new UnauthorizedException(
        'Authentication required to merge a guest cart into a customer account',
      );
    }

    await this.commandBus.execute(new MergeCartCommand(user.id, dto.guestId));

    const updated = await this.queryBus.execute(
      new GetCartQuery(user.id, null),
    );
    return { data: updated };
  }
}
