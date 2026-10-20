import { Inject, Logger } from '@nestjs/common';
import { CommandHandler, EventBus, ICommandHandler } from '@nestjs/cqrs';

import { AdjustStockCommand } from './adjust-stock.command.js';
import {
  INVENTORY_REPOSITORY,
  type InventoryRepositoryPort,
} from '../../ports/inventory.repository.js';
import { StockAdjustedEvent } from '../../../domain/events/stock-adjusted.event.js';
import {
  ApplicationException,
  ApplicationExceptionCode,
} from '../../../../shared/domain/exceptions/application.exception.js';

export interface AdjustStockResult {
  sku: string;
  delta: number;
  newOnHand: number;
  reason: string;
}

@CommandHandler(AdjustStockCommand)
export class AdjustStockCommandHandler implements ICommandHandler<
  AdjustStockCommand,
  AdjustStockResult
> {
  private readonly logger = new Logger(AdjustStockCommandHandler.name);

  constructor(
    @Inject(INVENTORY_REPOSITORY)
    private readonly inventoryRepository: InventoryRepositoryPort,
    private readonly eventBus: EventBus,
  ) {}

  async execute(command: AdjustStockCommand): Promise<AdjustStockResult> {
    const { sku, delta, reason, actorId, note } = command;

    if (delta === 0) {
      throw new ApplicationException(
        'Adjustment delta cannot be 0',
        ApplicationExceptionCode.VALIDATION_ERROR,
      );
    }

    this.logger.log(
      `Executing AdjustStockCommand: delta ${delta} for SKU '${sku}' (${reason})`,
    );

    const { newOnHand } = await this.inventoryRepository.atomicAdjust(
      sku,
      delta,
      reason,
      actorId,
      note,
    );

    this.eventBus.publish(
      new StockAdjustedEvent(sku, delta, newOnHand, reason, actorId, note),
    );

    return {
      sku: sku.trim().toUpperCase(),
      delta,
      newOnHand,
      reason,
    };
  }
}
