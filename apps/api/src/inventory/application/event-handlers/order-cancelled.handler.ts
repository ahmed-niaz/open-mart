import { Inject, Injectable, Logger } from '@nestjs/common';
import { CommandBus, EventsHandler, IEventHandler } from '@nestjs/cqrs';

import { OrderCancelledEvent } from '../../../order/domain/events/order-cancelled.event.js';
import {
  RESERVATION_REPOSITORY,
  type ReservationRepositoryPort,
} from '../ports/reservation.repository.js';
import { ReleaseStockCommand } from '../commands/release-stock/release-stock.command.js';
import { ReverseStockCommand } from '../commands/reverse-stock/reverse-stock.command.js';
import { EventDeduplicationService } from '../../../shared/infrastructure/outbox/event-deduplication.service.js';

@Injectable()
@EventsHandler(OrderCancelledEvent)
export class OrderCancelledInventoryHandler implements IEventHandler<OrderCancelledEvent> {
  private readonly logger = new Logger(OrderCancelledInventoryHandler.name);

  constructor(
    @Inject(RESERVATION_REPOSITORY)
    private readonly reservationRepository: ReservationRepositoryPort,
    private readonly commandBus: CommandBus,
    private readonly eventDeduplication: EventDeduplicationService,
  ) {}

  async handle(event: OrderCancelledEvent): Promise<void> {
    await this.eventDeduplication.executeIdempotently(
      (event as any).eventId,
      OrderCancelledInventoryHandler.name,
      async () => {
        this.logger.log(
          `Handling OrderCancelledEvent: processing inventory reversal/release for order '${event.orderId}'`,
        );

        try {
          const reservations = await this.reservationRepository.findByOrderId(
            event.orderId,
          );

          const hasCommitted = reservations.some(
            (r) => r.status === 'committed',
          );
          const hasReserved = reservations.some((r) => r.status === 'reserved');

          if (hasCommitted) {
            this.logger.log(
              `Order '${event.orderId}' was cancelled after confirmation. Reversing committed stock (restock to on-hand)...`,
            );
            await this.commandBus.execute(
              new ReverseStockCommand(
                event.orderId,
                `Order was cancelled: ${event.reason}`,
              ),
            );
          } else if (hasReserved) {
            this.logger.log(
              `Order '${event.orderId}' was cancelled before confirmation. Releasing reserved stock...`,
            );
            await this.commandBus.execute(
              new ReleaseStockCommand(
                event.orderId,
                `Order was cancelled: ${event.reason}`,
              ),
            );
          }
        } catch (err: any) {
          this.logger.error(
            `Failed to handle inventory release/reversal for cancelled order '${event.orderId}': ${err.message}`,
            err.stack,
          );
        }
      },
    );
  }
}
