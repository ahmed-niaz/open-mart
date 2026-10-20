import { Inject, Logger } from '@nestjs/common';
import { CommandHandler, EventBus, ICommandHandler } from '@nestjs/cqrs';

import { ReleaseStockCommand } from './release-stock.command.js';
import {
  RESERVATION_REPOSITORY,
  type ReservationRepositoryPort,
} from '../../ports/reservation.repository.js';
import { StockReleasedEvent } from '../../../domain/events/stock-released.event.js';

@CommandHandler(ReleaseStockCommand)
export class ReleaseStockCommandHandler implements ICommandHandler<
  ReleaseStockCommand,
  void
> {
  private readonly logger = new Logger(ReleaseStockCommandHandler.name);

  constructor(
    @Inject(RESERVATION_REPOSITORY)
    private readonly reservationRepository: ReservationRepositoryPort,
    private readonly eventBus: EventBus,
  ) {}

  async execute(command: ReleaseStockCommand): Promise<void> {
    const { orderId, reason } = command;
    this.logger.log(
      `Executing ReleaseStockCommand for order '${orderId}' (Reason: ${reason})`,
    );

    const releasedItems = await this.reservationRepository.releaseForOrder(
      orderId,
      reason,
    );

    for (const item of releasedItems) {
      this.eventBus.publish(
        new StockReleasedEvent(
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
