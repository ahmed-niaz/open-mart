import { Inject, Logger } from '@nestjs/common';
import { CommandHandler, EventBus, ICommandHandler } from '@nestjs/cqrs';

import { StocktakeCommand } from './stocktake.command.js';
import {
  INVENTORY_REPOSITORY,
  type InventoryRepositoryPort,
} from '../../ports/inventory.repository.js';
import { StockAdjustedEvent } from '../../../domain/events/stock-adjusted.event.js';
import {
  ApplicationException,
  ApplicationExceptionCode,
} from '../../../../shared/domain/exceptions/application.exception.js';

export interface StocktakeResult {
  sku: string;
  countedQuantity: number;
  delta: number;
  newOnHand: number;
}

@CommandHandler(StocktakeCommand)
export class StocktakeCommandHandler implements ICommandHandler<
  StocktakeCommand,
  StocktakeResult
> {
  private readonly logger = new Logger(StocktakeCommandHandler.name);

  constructor(
    @Inject(INVENTORY_REPOSITORY)
    private readonly inventoryRepository: InventoryRepositoryPort,
    private readonly eventBus: EventBus,
  ) {}

  async execute(command: StocktakeCommand): Promise<StocktakeResult> {
    const { sku, countedQuantity, actorId, note } = command;

    if (countedQuantity < 0) {
      throw new ApplicationException(
        'Counted physical quantity cannot be negative',
        ApplicationExceptionCode.VALIDATION_ERROR,
      );
    }

    this.logger.log(
      `Executing StocktakeCommand: setting physical count to ${countedQuantity} for SKU '${sku}'`,
    );

    const { delta, newOnHand } = await this.inventoryRepository.atomicStocktake(
      sku,
      countedQuantity,
      actorId,
      note,
    );

    this.eventBus.publish(
      new StockAdjustedEvent(
        sku,
        delta,
        newOnHand,
        'stocktake_adjustment',
        actorId,
        note,
      ),
    );

    return {
      sku: sku.trim().toUpperCase(),
      countedQuantity,
      delta,
      newOnHand,
    };
  }
}
