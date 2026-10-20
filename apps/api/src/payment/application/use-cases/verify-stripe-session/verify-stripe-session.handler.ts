import { Inject, Logger } from '@nestjs/common';
import {
  CommandBus,
  CommandHandler,
  EventBus,
  ICommandHandler,
} from '@nestjs/cqrs';

import { VerifyStripeSessionCommand } from './verify-stripe-session.command.js';
import {
  PAYMENT_REPOSITORY,
  type PaymentRepositoryPort,
} from '../../ports/payment.repository.js';
import {
  ORDER_PAYMENT_PORT,
  type OrderPaymentPort,
} from '../../ports/order-payment.port.js';
import { StripePaymentStrategy } from '../../../infrastructure/strategies/stripe.strategy.js';
import { PaymentCompletedIntegrationEvent } from '../../../../shared/contracts/events/payment-completed.event.js';
import { ConfirmOrderCommand } from '../../../../order/application/use-cases/confirm-order/confirm-order.command.js';
import { Payment } from '../../../domain/entities/payment.entity.js';
import { PaymentProvider } from '../../../domain/value-objects/payment-provider.vo.js';
import {
  ApplicationException,
  ApplicationExceptionCode,
} from '../../../../shared/domain/exceptions/application.exception.js';

export interface VerifyStripeSessionResult {
  paymentId: string;
  orderId: string;
  status: string;
  orderStatus: string;
  transactionId: string | null;
  paidAt: Date | null;
  alreadyProcessed: boolean;
}

@CommandHandler(VerifyStripeSessionCommand)
export class VerifyStripeSessionCommandHandler implements ICommandHandler<
  VerifyStripeSessionCommand,
  VerifyStripeSessionResult
> {
  private readonly logger = new Logger(VerifyStripeSessionCommandHandler.name);

  constructor(
    @Inject(PAYMENT_REPOSITORY)
    private readonly paymentRepository: PaymentRepositoryPort,
    @Inject(ORDER_PAYMENT_PORT)
    private readonly orderPaymentPort: OrderPaymentPort,
    private readonly stripeStrategy: StripePaymentStrategy,
    private readonly eventBus: EventBus,
    private readonly commandBus: CommandBus,
  ) {}

  async execute(
    command: VerifyStripeSessionCommand,
  ): Promise<VerifyStripeSessionResult> {
    const { sessionId } = command;
    this.logger.log(`Verifying Stripe Checkout Session: ${sessionId}`);

    // 1. Retrieve session directly from Stripe API
    const session = await this.stripeStrategy.retrieveSession(sessionId);
    if (!session) {
      throw new ApplicationException(
        `Stripe session '${sessionId}' not found`,
        ApplicationExceptionCode.NOT_FOUND,
      );
    }

    const orderId =
      (session.metadata?.orderId as string) ||
      session.client_reference_id ||
      '';

    // 2. Find or auto-reconstitute the local payment record
    let payment = await this.paymentRepository.findByTransactionId(sessionId);
    if (!payment && orderId) {
      payment = await this.paymentRepository.findByOrderId(orderId);
    }

    if (!payment && orderId) {
      this.logger.log(
        `No local payment found for order ${orderId} & session ${sessionId}. Checking order to auto-create payment...`,
      );
      const order = await this.orderPaymentPort.getOrderForPayment(orderId);
      if (order) {
        payment = Payment.create({
          orderId: order.orderId,
          customerId: order.customerId,
          provider: PaymentProvider.stripe(),
          amount: order.totalAmount,
          transactionId: sessionId,
        });
        await this.paymentRepository.save(payment);
      }
    }

    if (!payment) {
      throw new ApplicationException(
        `No payment or order record found for Stripe session '${sessionId}' (Order: ${orderId})`,
        ApplicationExceptionCode.NOT_FOUND,
      );
    }

    // 3. If payment is already completed, ensure order is confirmed and return
    if (payment.status.isCompleted()) {
      this.logger.log(
        `Payment ${payment.id.getValue()} is already completed. Ensuring order confirmation...`,
      );
      await this.commandBus.execute(new ConfirmOrderCommand(payment.orderId));

      return {
        paymentId: payment.id.getValue(),
        orderId: payment.orderId,
        status: payment.status.getValue(),
        orderStatus: 'confirmed',
        transactionId: payment.transactionId,
        paidAt: payment.paidAt,
        alreadyProcessed: true,
      };
    }

    // 4. Check if Stripe says the session is paid
    if (session.payment_status === 'paid') {
      const paymentIntentId =
        typeof session.payment_intent === 'string'
          ? session.payment_intent
          : session.id;

      this.logger.log(
        `Stripe session ${sessionId} is PAID (PaymentIntent: ${paymentIntentId}). Completing payment ${payment.id.getValue()}...`,
      );

      payment.complete(paymentIntentId);
      await this.paymentRepository.save(payment);

      // Directly dispatch ConfirmOrderCommand to guarantee immediate order confirmation
      try {
        await this.commandBus.execute(new ConfirmOrderCommand(payment.orderId));
        this.logger.log(
          `Order ${payment.orderId} successfully confirmed via CommandBus!`,
        );
      } catch (err: any) {
        this.logger.error(
          `Error executing ConfirmOrderCommand: ${err.message}`,
          err.stack,
        );
      }

      const customerEmail =
        (session.customer_details?.email as string) ||
        (session.customer_email as string) ||
        (payment.metadata?.customerEmail as string) ||
        null;
      const customerName =
        (session.customer_details?.name as string) ||
        (payment.metadata?.customerName as string) ||
        null;

      // Publish integration event (for notifications & cross-module listeners)
      this.eventBus.publish(
        new PaymentCompletedIntegrationEvent(
          payment.id.getValue(),
          payment.orderId,
          payment.customerId,
          payment.provider.getValue(),
          payment.transactionId || paymentIntentId,
          payment.amount.toCents(),
          payment.amount.getCurrency(),
          customerEmail,
          customerName,
          payment.paidAt || new Date(),
        ),
      );

      return {
        paymentId: payment.id.getValue(),
        orderId: payment.orderId,
        status: 'completed',
        orderStatus: 'confirmed',
        transactionId: payment.transactionId,
        paidAt: payment.paidAt,
        alreadyProcessed: false,
      };
    }

    // 5. Session is not paid yet
    this.logger.log(
      `Stripe session ${sessionId} payment_status is '${session.payment_status}'. No completion triggered.`,
    );
    return {
      paymentId: payment.id.getValue(),
      orderId: payment.orderId,
      status: payment.status.getValue(),
      orderStatus: 'pending',
      transactionId: payment.transactionId,
      paidAt: null,
      alreadyProcessed: false,
    };
  }
}
