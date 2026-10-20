import { Inject, Logger } from '@nestjs/common';
import { CommandHandler, EventBus, ICommandHandler } from '@nestjs/cqrs';

import { ReverseStockCommand } from './reverse-stock.command.js';
import {
  RESERVATION_REPOSITORY,
  type ReservationRepositoryPort,
} from '../../ports/reservation.repository.js';
import { StockReversedEvent } from '../../../domain/events/stock-reversed.event.js';

@CommandHandler(ReverseStockCommand)
export class ReverseStockCommandHandler implements ICommandHandler<
  ReverseStockCommand,
  void
> {
  private readonly logger = new Logger(ReverseStockCommandHandler.name);

  constructor(
    @Inject(RESERVATION_REPOSITORY)
    private readonly reservationRepository: ReservationRepositoryPort,
    private readonly eventBus: EventBus,
  ) {}

  async execute(command: ReverseStockCommand): Promise<void> {
    const { orderId, reason } = command;
    this.logger.log(
      `Executing ReverseStockCommand for order '${orderId}' (Reason: ${reason})`,
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
