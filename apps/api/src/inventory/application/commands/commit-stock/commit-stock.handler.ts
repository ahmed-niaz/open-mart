import { Inject, Logger } from '@nestjs/common';
import { CommandHandler, EventBus, ICommandHandler } from '@nestjs/cqrs';

import { CommitStockCommand } from './commit-stock.command.js';
import {
  RESERVATION_REPOSITORY,
  type ReservationRepositoryPort,
} from '../../ports/reservation.repository.js';
import { StockCommittedEvent } from '../../../domain/events/stock-committed.event.js';

@CommandHandler(CommitStockCommand)
export class CommitStockCommandHandler implements ICommandHandler<
  CommitStockCommand,
  void
> {
  private readonly logger = new Logger(CommitStockCommandHandler.name);

  constructor(
    @Inject(RESERVATION_REPOSITORY)
    private readonly reservationRepository: ReservationRepositoryPort,
    private readonly eventBus: EventBus,
  ) {}

  async execute(command: CommitStockCommand): Promise<void> {
    const { orderId } = command;
    this.logger.log(`Executing CommitStockCommand for order '${orderId}'`);

    const committedItems =
      await this.reservationRepository.commitForOrder(orderId);

    for (const item of committedItems) {
      this.eventBus.publish(
        new StockCommittedEvent(
          orderId,
          item.sku,
          item.quantity,
          item.newOnHand,
          new Date(),
        ),
      );
    }
  }
}
