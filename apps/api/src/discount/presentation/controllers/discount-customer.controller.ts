import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';
import { QueryBus } from '@nestjs/cqrs';
import { Throttle } from '@nestjs/throttler';

import { OptionalJwtAuthGuard } from '../../../shared/infrastructure/guards/optional-jwt-auth.guard.js';
import { CurrentUser } from '../../../customer/presentation/decorators/current-user.decorator.js';
import type { AuthenticatedUser } from '../../../customer/presentation/guards/jwt-auth.guard.js';
import { ValidateDiscountQuery } from '../../application/queries/validate-discount/validate-discount.query.js';
import { ValidateDiscountDto } from '../dto/validate-discount.dto.js';

@Controller('discounts')
export class DiscountCustomerController {
  constructor(private readonly queryBus: QueryBus) {}

  /**
   * POST /api/discounts/validate
   * Validates coupon code against the cart and customer eligibility.
   * Loads product prices from catalog server-side (zero client price trust).
   * Rate limited: 10 requests per minute per IP.
   */
  @Post('validate')
  @HttpCode(HttpStatus.OK)
  @UseGuards(OptionalJwtAuthGuard)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  async validate(
    @Body() dto: ValidateDiscountDto,
    @CurrentUser() user?: AuthenticatedUser,
  ) {
    const result = await this.queryBus.execute(
      new ValidateDiscountQuery(
        dto.code,
        dto.items,
        dto.shippingFee ?? 0,
        user?.id,
        user ? undefined : dto.guestEmail,
      ),
    );
    return { data: result };
  }
}
