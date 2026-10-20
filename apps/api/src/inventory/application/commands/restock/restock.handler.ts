import { Inject, Logger } from '@nestjs/common';
import { CommandHandler, EventBus, ICommandHandler } from '@nestjs/cqrs';

import { RestockCommand } from './restock.command.js';
import {
  INVENTORY_REPOSITORY,
  type InventoryRepositoryPort,
} from '../../ports/inventory.repository.js';
import { StockRestockedEvent } from '../../../domain/events/stock-restocked.event.js';
import {
  ApplicationException,
  ApplicationExceptionCode,
} from '../../../../shared/domain/exceptions/application.exception.js';

export interface RestockResult {
  sku: string;
  quantityAdded: number;
  newOnHand: number;
}

@CommandHandler(RestockCommand)
export class RestockCommandHandler implements ICommandHandler<
  RestockCommand,
  RestockResult
> {
  private readonly logger = new Logger(RestockCommandHandler.name);

  constructor(
    @Inject(INVENTORY_REPOSITORY)
    private readonly inventoryRepository: InventoryRepositoryPort,
    private readonly eventBus: EventBus,
  ) {}

  async execute(command: RestockCommand): Promise<RestockResult> {
    const { sku, quantity, actorId, note } = command;

    if (quantity <= 0) {
      throw new ApplicationException(
        'Restock quantity must be greater than 0',
        ApplicationExceptionCode.VALIDATION_ERROR,
      );
    }

    this.logger.log(`Executing RestockCommand: +${quantity} for SKU '${sku}'`);

    const { newOnHand } = await this.inventoryRepository.atomicRestock(
      sku,
      quantity,
      actorId,
      note,
    );

    this.eventBus.publish(
      new StockRestockedEvent(sku, quantity, newOnHand, actorId, note),
    );

    return {
      sku: sku.trim().toUpperCase(),
      quantityAdded: quantity,
      newOnHand,
    };
  }
}
