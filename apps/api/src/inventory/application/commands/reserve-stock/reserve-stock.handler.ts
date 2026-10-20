import { Inject, Logger } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';

import { ReserveStockCommand } from './reserve-stock.command.js';
import {
  INVENTORY_RESERVATION_PORT,
  type InventoryReservationPort,
} from '../../ports/inventory-reservation.port.js';

@CommandHandler(ReserveStockCommand)
export class ReserveStockCommandHandler implements ICommandHandler<
  ReserveStockCommand,
  void
> {
  private readonly logger = new Logger(ReserveStockCommandHandler.name);

  constructor(
    @Inject(INVENTORY_RESERVATION_PORT)
    private readonly reservationPort: InventoryReservationPort,
  ) {}

  async execute(command: ReserveStockCommand): Promise<void> {
    const { orderId, items, ttlMinutes } = command;
    this.logger.log(
      `Executing ReserveStockCommand for order '${orderId}' (${items.length} items, TTL: ${ttlMinutes}m)`,
    );

    await this.reservationPort.reserveStock(orderId, items, ttlMinutes);
  }
}
