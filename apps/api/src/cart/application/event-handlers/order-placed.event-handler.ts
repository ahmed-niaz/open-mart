import { Inject, Logger } from '@nestjs/common';
import { EventsHandler, IEventHandler } from '@nestjs/cqrs';

import { OrderPlacedEvent } from '../../../order/domain/events/order-placed.event.js';
import {
  CART_REPOSITORY,
  type CartRepositoryPort,
} from '../ports/cart.repository.js';
import { EventDeduplicationService } from '../../../shared/infrastructure/outbox/event-deduplication.service.js';

@EventsHandler(OrderPlacedEvent)
export class OrderPlacedCartHandler implements IEventHandler<OrderPlacedEvent> {
  private readonly logger = new Logger(OrderPlacedCartHandler.name);

  constructor(
    @Inject(CART_REPOSITORY)
    private readonly cartRepository: CartRepositoryPort,
    private readonly eventDeduplication: EventDeduplicationService,
  ) {}

  async handle(event: OrderPlacedEvent): Promise<void> {
    await this.eventDeduplication.executeIdempotently(
      (event as any).eventId,
      OrderPlacedCartHandler.name,
      async () => {
        if (!event.customerId) {
          return;
        }

        const cart = await this.cartRepository.findActiveByCustomerId(
          event.customerId,
        );

        if (!cart) {
          return;
        }

        this.logger.log(
          `Converting customer cart '${cart.id.getValue()}' upon OrderPlacedEvent for order '${event.orderId}'`,
        );

        cart.markConverted(event.orderId);
        await this.cartRepository.save(cart);
      },
    );
  }
}
