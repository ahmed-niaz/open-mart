import { Inject, Logger } from '@nestjs/common';
import { EventBus, EventsHandler, IEventHandler } from '@nestjs/cqrs';

import { OrderDeliveredEvent } from '../../../order/domain/events/order-delivered.event.js';
import {
  PAYMENT_REPOSITORY,
  type PaymentRepositoryPort,
} from '../ports/payment.repository.js';
import { PaymentCompletedIntegrationEvent } from '../../../shared/contracts/events/payment-completed.event.js';

@EventsHandler(OrderDeliveredEvent)
export class OrderDeliveredPaymentHandler implements IEventHandler<OrderDeliveredEvent> {
  private readonly logger = new Logger(OrderDeliveredPaymentHandler.name);

  constructor(
    @Inject(PAYMENT_REPOSITORY)
    private readonly paymentRepository: PaymentRepositoryPort,
    private readonly eventBus: EventBus,
  ) {}

  async handle(event: OrderDeliveredEvent): Promise<void> {
    this.logger.log(
      `Handling OrderDeliveredEvent for payment reconciliation on order: ${event.orderId}`,
    );

    const payment = await this.paymentRepository.findByOrderId(event.orderId);
    if (!payment) {
      return;
    }

    // Cash on Delivery is collected upon physical delivery
    if (
      payment.provider.isCod() &&
      (payment.status.isPending() || payment.status.isProcessing())
    ) {
      this.logger.log(
        `Order ${event.orderId} delivered! Marking COD payment ${payment.id.getValue()} as completed.`,
      );

      const paidAt = new Date();
      payment.complete(payment.transactionId || `COD-COLLECTED`, paidAt);
      await this.paymentRepository.save(payment);

      const customerEmail = (payment.metadata?.customerEmail as string) || null;
      const customerName = (payment.metadata?.customerName as string) || null;

      this.eventBus.publish(
        new PaymentCompletedIntegrationEvent(
          payment.id.getValue(),
          payment.orderId,
          payment.customerId,
          payment.provider.getValue(),
          payment.transactionId || 'COD-COLLECTED',
          payment.amount.toCents(),
          payment.amount.getCurrency(),
          customerEmail,
          customerName,
          paidAt,
        ),
      );
    }
  }
}
