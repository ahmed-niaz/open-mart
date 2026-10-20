import { Inject, Logger } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';

import { UpdateSettingsCommand } from './update-settings.command.js';
import {
  INVENTORY_REPOSITORY,
  type InventoryRepositoryPort,
} from '../../ports/inventory.repository.js';
import {
  ApplicationException,
  ApplicationExceptionCode,
} from '../../../../shared/domain/exceptions/application.exception.js';

export interface UpdateSettingsResult {
  sku: string;
  lowStockThreshold: number;
  isActive: boolean;
  version: number;
}

@CommandHandler(UpdateSettingsCommand)
export class UpdateSettingsCommandHandler implements ICommandHandler<
  UpdateSettingsCommand,
  UpdateSettingsResult
> {
  private readonly logger = new Logger(UpdateSettingsCommandHandler.name);

  constructor(
    @Inject(INVENTORY_REPOSITORY)
    private readonly inventoryRepository: InventoryRepositoryPort,
  ) {}

  async execute(command: UpdateSettingsCommand): Promise<UpdateSettingsResult> {
    const { sku, lowStockThreshold, isActive } = command;
    this.logger.log(`Executing UpdateSettingsCommand for SKU '${sku}'`);

    const item = await this.inventoryRepository.findBySku(sku);
    if (!item) {
      throw new ApplicationException(
        `Inventory item with SKU '${sku}' not found`,
        ApplicationExceptionCode.NOT_FOUND,
      );
    }

    item.updateSettings(lowStockThreshold, isActive);
    await this.inventoryRepository.save(item);

    return {
      sku: item.sku.getValue(),
      lowStockThreshold: item.lowStockThreshold,
      isActive: item.isActive,
      version: item.version,
    };
  }
}
