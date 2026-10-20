import { Inject, Logger } from '@nestjs/common';
import { CommandHandler, EventBus, ICommandHandler } from '@nestjs/cqrs';

import { CancelPaymentCommand } from './cancel-payment.command.js';
import {
  PAYMENT_REPOSITORY,
  type PaymentRepositoryPort,
} from '../../ports/payment.repository.js';
import { PaymentCancelledIntegrationEvent } from '../../../../shared/contracts/events/payment-cancelled.event.js';
import {
  ApplicationException,
  ApplicationExceptionCode,
} from '../../../../shared/domain/exceptions/application.exception.js';

export interface CancelPaymentResult {
  paymentId: string;
  orderId: string;
  status: string;
  reason: string;
}

@CommandHandler(CancelPaymentCommand)
export class CancelPaymentCommandHandler
  implements ICommandHandler<CancelPaymentCommand, CancelPaymentResult>
{
  private readonly logger = new Logger(CancelPaymentCommandHandler.name);

  constructor(
    @Inject(PAYMENT_REPOSITORY)
    private readonly paymentRepository: PaymentRepositoryPort,
    private readonly eventBus: EventBus,
  ) {}

  async execute(command: CancelPaymentCommand): Promise<CancelPaymentResult> {
    const { orderId, reason } = command;
    const cancelReason = reason || 'Payment cancelled by customer';

    this.logger.log(`Cancelling payment for order: ${orderId}`);

    const payment = await this.paymentRepository.findByOrderId(orderId);
    if (!payment) {
      throw new ApplicationException(
        `No payment found for order: ${orderId}`,
        ApplicationExceptionCode.NOT_FOUND,
      );
    }

    if (payment.status.isCompleted()) {
      throw new ApplicationException(
        `Cannot cancel a payment that is already completed (Order: ${orderId})`,
        ApplicationExceptionCode.CONFLICT,
      );
    }

    if (payment.status.isCancelled()) {
      return {
        paymentId: payment.id.getValue(),
        orderId: payment.orderId,
        status: payment.status.getValue(),
        reason: payment.failureReason || cancelReason,
      };
    }

    payment.cancel(cancelReason);
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
        cancelReason,
        customerEmail,
        customerName,
        new Date(),
      ),
    );

    return {
      paymentId: payment.id.getValue(),
      orderId: payment.orderId,
      status: payment.status.getValue(),
      reason: cancelReason,
    };
  }
}

