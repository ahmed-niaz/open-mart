import { Inject, Logger } from '@nestjs/common';
import { CommandHandler, EventBus, ICommandHandler } from '@nestjs/cqrs';

import { ReturnStockCommand } from './return-stock.command.js';
import {
  RESERVATION_REPOSITORY,
  type ReservationRepositoryPort,
} from '../../ports/reservation.repository.js';
import { StockReversedEvent } from '../../../domain/events/stock-reversed.event.js';

@CommandHandler(ReturnStockCommand)
export class ReturnStockCommandHandler implements ICommandHandler<
  ReturnStockCommand,
  void
> {
  private readonly logger = new Logger(ReturnStockCommandHandler.name);

  constructor(
    @Inject(RESERVATION_REPOSITORY)
    private readonly reservationRepository: ReservationRepositoryPort,
    private readonly eventBus: EventBus,
  ) {}

  async execute(command: ReturnStockCommand): Promise<void> {
    const { orderId, reason } = command;
    this.logger.log(
      `Executing ReturnStockCommand for order '${orderId}' (Reason: ${reason})`,
    );

    const reversedItems = await this.reservationRepository.reverseForOrder(
      orderId,
      reason,
    );

    for (const item of reversedItems) {
      this.eventBus.publish(
        new StockReversedEvent(
          orderId,
          item.sku,
          item.quantity,
          reason,
          new Date(),
        ),
      );
    }
  }
}
