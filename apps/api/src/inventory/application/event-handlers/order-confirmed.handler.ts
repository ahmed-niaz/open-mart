import { Injectable, Logger } from '@nestjs/common';
import { CommandBus, EventsHandler, IEventHandler } from '@nestjs/cqrs';

import { OrderConfirmedEvent } from '../../../order/domain/events/order-confirmed.event.js';
import { CommitStockCommand } from '../commands/commit-stock/commit-stock.command.js';

@Injectable()
@EventsHandler(OrderConfirmedEvent)
export class OrderConfirmedInventoryHandler implements IEventHandler<OrderConfirmedEvent> {
  private readonly logger = new Logger(OrderConfirmedInventoryHandler.name);

  constructor(private readonly commandBus: CommandBus) {}

  async handle(event: OrderConfirmedEvent): Promise<void> {
    this.logger.log(
      `Handling OrderConfirmedEvent: committing inventory stock for order '${event.orderId}'`,
    );

    try {
      await this.commandBus.execute(new CommitStockCommand(event.orderId));
    } catch (err: any) {
      this.logger.error(
        `Failed to commit stock for confirmed order '${event.orderId}': ${err.message}`,
        err.stack,
      );
    }
  }
}
