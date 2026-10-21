import { Inject, Logger } from '@nestjs/common';
import {
  CommandBus,
  EventBus,
  EventsHandler,
  IEventHandler,
} from '@nestjs/cqrs';

import { OrderCancelledEvent } from '../../../order/domain/events/order-cancelled.event.js';
import {
  PAYMENT_REPOSITORY,
  type PaymentRepositoryPort,
} from '../ports/payment.repository.js';
import { PaymentCancelledIntegrationEvent } from '../../../shared/contracts/events/payment-cancelled.event.js';
import { EventDeduplicationService } from '../../../shared/infrastructure/outbox/event-deduplication.service.js';
import { RefundPaymentCommand } from '../use-cases/refund-payment/refund-payment.command.js';

@EventsHandler(OrderCancelledEvent)
export class OrderCancelledPaymentHandler implements IEventHandler<OrderCancelledEvent> {
  private readonly logger = new Logger(OrderCancelledPaymentHandler.name);

  constructor(
    @Inject(PAYMENT_REPOSITORY)
    private readonly paymentRepository: PaymentRepositoryPort,
    private readonly commandBus: CommandBus,
    private readonly eventBus: EventBus,
    private readonly eventDeduplication: EventDeduplicationService,
  ) {}

  async handle(event: OrderCancelledEvent): Promise<void> {
    await this.eventDeduplication.executeIdempotently(
      (event as any).eventId,
      OrderCancelledPaymentHandler.name,
      async () => {
        this.logger.log(
          `Handling OrderCancelledEvent for payment adjustment on order: ${event.orderId}`,
        );

        const payment = await this.paymentRepository.findByOrderId(
          event.orderId,
        );
        if (!payment) {
          return;
        }

        // Case 1: Payment was already completed -> auto-refund for pre-shipment cancellation
        if (payment.status.isCompleted()) {
          const refundableAmount =
            payment.amount.toCents() - payment.refundedAmount.toCents();

          if (refundableAmount > 0) {
            this.logger.log(
              `Initiating pre-shipment auto-refund of ${refundableAmount} cents for payment ${payment.id.getValue()} (Order: ${event.orderId})`,
            );

            await this.commandBus.execute(
              new RefundPaymentCommand(
                payment.id.getValue(),
                refundableAmount,
                `Auto-refund: order cancelled pre-shipment (${event.reason})`,
                'system:order-cancellation',
                payment.provider.isCod(),
              ),
            );
          }
          return;
        }

        // Case 2: Payment is still pending or processing -> cancel payment attempt
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
