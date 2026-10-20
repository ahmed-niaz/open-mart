import { Inject, Logger } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';

import { InitiatePaymentCommand } from './initiate-payment.command.js';
import { InitiatePaymentResponseDto } from '../../dto/initiate-payment-response.dto.js';
import {
  ORDER_PAYMENT_PORT,
  type OrderPaymentPort,
} from '../../ports/order-payment.port.js';
import {
  PAYMENT_REPOSITORY,
  type PaymentRepositoryPort,
} from '../../ports/payment.repository.js';
import { PaymentStrategyRegistry } from '../../../infrastructure/strategies/payment-strategy.registry.js';
import { Payment } from '../../../domain/entities/payment.entity.js';
import { PaymentProvider } from '../../../domain/value-objects/payment-provider.vo.js';
import {
  ApplicationException,
  ApplicationExceptionCode,
} from '../../../../shared/domain/exceptions/application.exception.js';

@CommandHandler(InitiatePaymentCommand)
export class InitiatePaymentCommandHandler implements ICommandHandler<
  InitiatePaymentCommand,
  InitiatePaymentResponseDto
> {
  private readonly logger = new Logger(InitiatePaymentCommandHandler.name);

  constructor(
    @Inject(ORDER_PAYMENT_PORT)
    private readonly orderPaymentPort: OrderPaymentPort,
    @Inject(PAYMENT_REPOSITORY)
    private readonly paymentRepository: PaymentRepositoryPort,
    private readonly strategyRegistry: PaymentStrategyRegistry,
  ) {}

  async execute(
    command: InitiatePaymentCommand,
  ): Promise<InitiatePaymentResponseDto> {
    const order = await this.orderPaymentPort.getOrderForPayment(
      command.orderId,
    );
    if (!order) {
      throw new ApplicationException(
        `Order with ID '${command.orderId}' was not found`,
        ApplicationExceptionCode.NOT_FOUND,
      );
    }

    if (order.status !== 'pending') {
      throw new ApplicationException(
        `Cannot initiate payment for order '${command.orderId}' in '${order.status}' status. Only pending orders can be paid.`,
        ApplicationExceptionCode.VALIDATION_ERROR,
      );
    }

    const providerVo = PaymentProvider.fromString(command.provider);

    // Check for existing payments for this order
    const existingPayment = await this.paymentRepository.findByOrderId(
      command.orderId,
    );

    if (existingPayment) {
      if (existingPayment.status.isCompleted()) {
        throw new ApplicationException(
          `Order '${command.orderId}' has already been paid`,
          ApplicationExceptionCode.CONFLICT,
        );
      }

      // If there is an active pending/processing payment, cancel it so a new session can be started
      if (
        existingPayment.status.isPending() ||
        existingPayment.status.isProcessing()
      ) {
        this.logger.log(
          `Cancelling previous active payment attempt '${existingPayment.id.getValue()}' before initiating new attempt with ${command.provider}`,
        );
        existingPayment.cancel(
          `Superseded by new payment initiation with ${command.provider}`,
        );
        await this.paymentRepository.save(existingPayment);
      }
    }

    const customerEmail =
      command.customerEmail || order.customerEmail || 'customer@example.com';

    // 1. Create the new Payment Aggregate in 'pending' status
    const payment = Payment.create({
      orderId: order.orderId,
      customerId: order.customerId,
      provider: providerVo,
      amount: order.totalAmount,
      idempotencyKey: command.idempotencyKey,
      metadata: {
        customerEmail,
        customerName: order.customerName ?? order.shippingAddress.recipientName,
      },
    });

    // 2. Delegate to Gateway Strategy
    const strategy = this.strategyRegistry.getStrategy(providerVo);
    const strategyResult = await strategy.initiatePayment({
      paymentId: payment.id.getValue(),
      orderId: order.orderId,
      amount: order.totalAmount,
      customerEmail,
      customerName: order.customerName ?? undefined,
      customerPhone: order.customerPhone ?? undefined,
      shippingAddress: order.shippingAddress,
      idempotencyKey: command.idempotencyKey,
    });

    // 3. Update payment with strategy's transaction reference and metadata
    payment.assignTransactionId(strategyResult.transactionId);
    if (strategyResult.metadata) {
      payment.updateMetadata(strategyResult.metadata);
    }

    // 4. Persist payment
    await this.paymentRepository.save(payment);

    return {
      paymentId: payment.id.getValue(),
      orderId: payment.orderId,
      provider: payment.provider.getValue(),
      status: payment.status.getValue(),
      amount: payment.amount.toCents(),
      currency: payment.amount.getCurrency(),
      checkoutUrl: strategyResult.checkoutUrl,
      transactionId: strategyResult.transactionId,
      clientSecret: strategyResult.clientSecret,
      metadata: payment.metadata,
    };
  }
}
