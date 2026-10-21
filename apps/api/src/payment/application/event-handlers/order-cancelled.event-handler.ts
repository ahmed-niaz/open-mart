import { Inject, Logger } from '@nestjs/common';
import { EventBus, EventsHandler, IEventHandler } from '@nestjs/cqrs';

import { OrderCancelledEvent } from '../../../order/domain/events/order-cancelled.event.js';
import {
  PAYMENT_REPOSITORY,
  type PaymentRepositoryPort,
} from '../ports/payment.repository.js';
import { PaymentCancelledIntegrationEvent } from '../../../shared/contracts/events/payment-cancelled.event.js';
import { EventDeduplicationService } from '../../../shared/infrastructure/outbox/event-deduplication.service.js';

@EventsHandler(OrderCancelledEvent)
export class OrderCancelledPaymentHandler implements IEventHandler<OrderCancelledEvent> {
  private readonly logger = new Logger(OrderCancelledPaymentHandler.name);

  constructor(
    @Inject(PAYMENT_REPOSITORY)
    private readonly paymentRepository: PaymentRepositoryPort,
    private readonly eventBus: EventBus,
    private readonly eventDeduplication: EventDeduplicationService,
  ) {}

  async handle(event: OrderCancelledEvent): Promise<void> {
    await this.eventDeduplication.executeIdempotently(
      (event as any).eventId,
      OrderCancelledPaymentHandler.name,
      async () => {
        this.logger.log(
          `Handling OrderCancelledEvent for payment cancellation on order: ${event.orderId}`,
        );

        const payment = await this.paymentRepository.findByOrderId(
          event.orderId,
        );
        if (!payment) {
          return;
        }

        if (payment.status.isPending() || payment.status.isProcessing()) {
          this.logger.log(
            `Cancelling active payment ${payment.id.getValue()} due to order cancellation`,
          );
          payment.cancel(`Order was cancelled: ${event.reason}`);
          await this.paymentRepository.save(payment);

          const customerEmail =
            (payment.metadata?.customerEmail as string) || null;
          const customerName =
            (payment.metadata?.customerName as string) || null;

          this.eventBus.publish(
            new PaymentCancelledIntegrationEvent(
              payment.id.getValue(),
              payment.orderId,
              payment.customerId,
              payment.provider.getValue(),
              `Order was cancelled: ${event.reason}`,
              customerEmail,
              customerName,
              new Date(),
            ),
          );
        }
      },
    );
  }
}
