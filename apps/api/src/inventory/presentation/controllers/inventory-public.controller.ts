import { BadRequestException, Controller, Get, Query } from '@nestjs/common';
import { QueryBus } from '@nestjs/cqrs';
import { Throttle } from '@nestjs/throttler';

import { GetAvailabilityQuery } from '../../application/queries/get-availability/get-availability.query.js';
import { QueryAvailabilityDto } from '../dto/query-availability.dto.js';

@Controller('inventory')
export class InventoryPublicController {
  constructor(private readonly queryBus: QueryBus) {}

  /**
   * GET /api/inventory/availability?skus=SKU1,SKU2
   * Public storefront query for batch stock availability check.
   * Returns categorical statuses ('in_stock', 'low_stock', 'out_of_stock')
   * without exposing actual warehouse numbers.
   */
  @Get('availability')
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  async getAvailability(@Query() dto: QueryAvailabilityDto) {
    if (!dto.skus || dto.skus.trim().length === 0) {
      throw new BadRequestException('skus query parameter is required');
    }

    const skuList = dto.skus
      .split(',')
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    if (skuList.length > 50) {
      throw new BadRequestException('Cannot query more than 50 SKUs at once');
    }

    const result = await this.queryBus.execute(
      new GetAvailabilityQuery(skuList),
    );

    return { data: result };
  }
}
