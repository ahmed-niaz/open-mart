import { Injectable, Logger } from '@nestjs/common';
import { CommandBus, EventsHandler, IEventHandler } from '@nestjs/cqrs';

import { OrderReturnedEvent } from '../../../order/domain/events/order-returned.event.js';
import { ReturnStockCommand } from '../commands/return-stock/return-stock.command.js';

@Injectable()
@EventsHandler(OrderReturnedEvent)
export class OrderReturnedInventoryHandler implements IEventHandler<OrderReturnedEvent> {
  private readonly logger = new Logger(OrderReturnedInventoryHandler.name);

  constructor(private readonly commandBus: CommandBus) {}

  async handle(event: OrderReturnedEvent): Promise<void> {
    this.logger.log(
      `Handling OrderReturnedEvent: restocking returned items for order '${event.orderId}'`,
    );

    try {
      await this.commandBus.execute(
        new ReturnStockCommand(
          event.orderId,
          `Order item returned: ${event.reason}`,
        ),
      );
    } catch (err: any) {
      this.logger.error(
        `Failed to restock returned order '${event.orderId}': ${err.message}`,
        err.stack,
      );
    }
  }
}
