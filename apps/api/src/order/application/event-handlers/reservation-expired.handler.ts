import { Injectable, Logger } from '@nestjs/common';
import { CommandBus, EventsHandler, IEventHandler } from '@nestjs/cqrs';

import { ReservationExpiredEvent } from '../../../inventory/domain/events/reservation-expired.event.js';
import { CancelOrderCommand } from '../use-cases/cancel-order/cancel-order.command.js';

@Injectable()
@EventsHandler(ReservationExpiredEvent)
export class ReservationExpiredOrderHandler implements IEventHandler<ReservationExpiredEvent> {
  private readonly logger = new Logger(ReservationExpiredOrderHandler.name);

  constructor(private readonly commandBus: CommandBus) {}

  async handle(event: ReservationExpiredEvent): Promise<void> {
    this.logger.log(
      `Handling ReservationExpiredEvent for order '${event.orderId}' (SKU: ${event.sku}). Cancelling abandoned order...`,
    );

    try {
      await this.commandBus.execute(
        new CancelOrderCommand(
          event.orderId,
          'Payment timeout: stock reservation expired',
        ),
      );
    } catch (err: any) {
      // Order might have already transitioned or been cancelled
      this.logger.warn(
        `Could not cancel order '${event.orderId}' after reservation expiry: ${err.message}`,
      );
    }
  }
}
