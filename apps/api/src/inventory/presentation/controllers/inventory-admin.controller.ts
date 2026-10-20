import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';

import { RestockCommand } from '../../application/commands/restock/restock.command.js';
import { AdjustStockCommand } from '../../application/commands/adjust-stock/adjust-stock.command.js';
import { StocktakeCommand } from '../../application/commands/stocktake/stocktake.command.js';
import { UpdateSettingsCommand } from '../../application/commands/update-settings/update-settings.command.js';
import { ListInventoryQuery } from '../../application/queries/list-inventory/list-inventory.query.js';
import { GetInventoryBySkuQuery } from '../../application/queries/get-inventory-by-sku/get-inventory-by-sku.query.js';
import { GetInventoryMovementsQuery } from '../../application/queries/get-inventory-movements/get-inventory-movements.query.js';
import { RestockDto } from '../dto/restock.dto.js';
import { AdjustStockDto } from '../dto/adjust-stock.dto.js';
import { StocktakeDto } from '../dto/stocktake.dto.js';
import { UpdateSettingsDto } from '../dto/update-settings.dto.js';
import { ListInventoryQueryDto } from '../dto/list-inventory-query.dto.js';

@Controller('admin/inventory')
export class InventoryAdminController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
  ) {}

  /**
   * GET /api/admin/inventory
   * Paginated warehouse stock list with status filters (low_stock, out_of_stock).
   */
  @Get()
  async listInventory(@Query() query: ListInventoryQueryDto) {
    const result = await this.queryBus.execute(
      new ListInventoryQuery(
        query.search,
        query.status,
        query.page,
        query.limit,
      ),
    );
    return { data: result };
  }

  /**
   * GET /api/admin/inventory/:sku
   * Detailed stock breakdown for a specific SKU.
   */
  @Get(':sku')
  async getInventoryBySku(@Param('sku') sku: string) {
    const result = await this.queryBus.execute(new GetInventoryBySkuQuery(sku));
    return { data: result };
  }

  /**
   * GET /api/admin/inventory/:sku/movements
   * Immutable movement ledger / audit history for a SKU.
   */
  @Get(':sku/movements')
  async getInventoryMovements(
    @Param('sku') sku: string,
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 20,
  ) {
    const result = await this.queryBus.execute(
      new GetInventoryMovementsQuery(sku, Number(page), Number(limit)),
    );
    return { data: result };
  }

  /**
   * POST /api/admin/inventory/restock
   * Record warehouse inbound receipt.
   * Requires X-Idempotency-Key.
   */
  @Post('restock')
  @HttpCode(HttpStatus.OK)
  async restock(
    @Body() dto: RestockDto,
    @Headers('x-idempotency-key') idempotencyKey?: string,
  ) {
    const key = idempotencyKey?.trim();
    if (!key || key.length < 8) {
      throw new BadRequestException(
        'X-Idempotency-Key header is required (at least 8 characters)',
      );
    }

    const result = await this.commandBus.execute(
      new RestockCommand(dto.sku, dto.quantity, 'admin', dto.note),
    );
    return { data: result };
  }

  /**
   * POST /api/admin/inventory/adjust
   * Record damaged, lost, or scrapped inventory.
   * Requires X-Idempotency-Key.
   */
  @Post('adjust')
  @HttpCode(HttpStatus.OK)
  async adjustStock(
    @Body() dto: AdjustStockDto,
    @Headers('x-idempotency-key') idempotencyKey?: string,
  ) {
    const key = idempotencyKey?.trim();
    if (!key || key.length < 8) {
      throw new BadRequestException(
        'X-Idempotency-Key header is required (at least 8 characters)',
      );
    }

    const result = await this.commandBus.execute(
      new AdjustStockCommand(dto.sku, dto.delta, dto.reason, 'admin', dto.note),
    );
    return { data: result };
  }

  /**
   * POST /api/admin/inventory/stocktake
   * Physical warehouse count recount.
   */
  @Post('stocktake')
  @HttpCode(HttpStatus.OK)
  async stocktake(@Body() dto: StocktakeDto) {
    const result = await this.commandBus.execute(
      new StocktakeCommand(dto.sku, dto.countedQuantity, 'admin', dto.note),
    );
    return { data: result };
  }

  /**
   * PATCH /api/admin/inventory/:sku/settings
   * Update administrative threshold and active status.
   */
  @Patch(':sku/settings')
  async updateSettings(
    @Param('sku') sku: string,
    @Body() dto: UpdateSettingsDto,
  ) {
    const result = await this.commandBus.execute(
      new UpdateSettingsCommand(sku, dto.lowStockThreshold, dto.isActive),
    );
    return { data: result };
  }
}
