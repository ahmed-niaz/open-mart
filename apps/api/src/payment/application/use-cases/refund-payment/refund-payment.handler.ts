import { Inject, Logger } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';

import { RefundPaymentCommand } from './refund-payment.command.js';
import { RefundPaymentResultDto } from './refund-payment-result.dto.js';
import {
  PAYMENT_REPOSITORY,
  type PaymentRepositoryPort,
} from '../../ports/payment.repository.js';
import { PaymentId } from '../../../domain/value-objects/payment-id.vo.js';
import { PaymentStrategyRegistry } from '../../../infrastructure/strategies/payment-strategy.registry.js';
import { Money } from '../../../../shared/domain/value-objects/money.vo.js';
import {
  ApplicationException,
  ApplicationExceptionCode,
} from '../../../../shared/domain/exceptions/application.exception.js';

@CommandHandler(RefundPaymentCommand)
export class RefundPaymentCommandHandler implements ICommandHandler<
  RefundPaymentCommand,
  RefundPaymentResultDto
> {
  private readonly logger = new Logger(RefundPaymentCommandHandler.name);

  constructor(
    @Inject(PAYMENT_REPOSITORY)
    private readonly paymentRepository: PaymentRepositoryPort,
    private readonly strategyRegistry: PaymentStrategyRegistry,
  ) {}

  async execute(
    command: RefundPaymentCommand,
  ): Promise<RefundPaymentResultDto> {
    this.logger.log(
      `Executing RefundPaymentCommand for payment '${command.paymentId}' (Amount: ${command.amountCents}, InitiatedBy: ${command.initiatedBy})`,
    );

    const payment = await this.paymentRepository.findById(
      PaymentId.fromString(command.paymentId),
    );

    if (!payment) {
      throw new ApplicationException(
        `Payment '${command.paymentId}' was not found`,
        ApplicationExceptionCode.NOT_FOUND,
      );
    }

    const refundAmount = Money.fromCents(
      command.amountCents,
      payment.amount.getCurrency(),
    );

    // Phase 1: Initiate refund in domain aggregate (sets status to 'refund_pending' and creates refund record)
    const refund = payment.initiateRefund({
      amount: refundAmount,
      reason: command.reason,
      initiatedBy: command.initiatedBy,
      isOfflinePayout: command.isOfflinePayout || payment.provider.isCod(),
      offlineReference: command.offlineReference ?? null,
    });

    // Save aggregate: atomically persists refund record and stages PaymentRefundInitiatedEvent in outbox
    await this.paymentRepository.save(payment);

    // Phase 2: Execution
    if (command.isOfflinePayout || payment.provider.isCod()) {
      // Manual offline payout (COD cash refund / bKash manual transfer)
      this.logger.log(
        `Processing offline refund payout for payment '${payment.id.getValue()}'`,
      );
      const reference =
        command.offlineReference || `OFFLINE-${refund.id.slice(0, 8)}`;
      payment.completeRefund(refund.id, reference);
      await this.paymentRepository.save(payment);

      return {
        refundId: refund.id,
        paymentId: payment.id.getValue(),
        orderId: payment.orderId,
        amountCents: refund.amount.toCents(),
        currency: refund.amount.getCurrency(),
        status: 'completed',
        gatewayRefundId: reference,
        isOfflinePayout: true,
      };
    }

    // Online Gateway refund (Stripe / SSLCommerz)
    const strategy = this.strategyRegistry.getStrategy(payment.provider);
    if (!strategy.refund) {
      payment.failRefund(
        refund.id,
        `Payment provider '${payment.provider.getValue()}' does not support automated refunds`,
      );
      await this.paymentRepository.save(payment);

      return {
        refundId: refund.id,
        paymentId: payment.id.getValue(),
        orderId: payment.orderId,
        amountCents: refund.amount.toCents(),
        currency: refund.amount.getCurrency(),
        status: 'failed',
        failureReason: `Payment provider '${payment.provider.getValue()}' does not support automated refunds`,
        isOfflinePayout: false,
      };
    }

    try {
      const gatewayResult = await strategy.refund(
        payment.transactionId ?? payment.id.getValue(),
        refundAmount,
        command.reason,
        command.idempotencyKey ?? undefined,
        payment.metadata ?? undefined,
      );

      if (gatewayResult.status === 'completed') {
        payment.completeRefund(refund.id, gatewayResult.refundId);
      } else if (gatewayResult.status === 'failed') {
        payment.failRefund(
          refund.id,
          gatewayResult.failureReason || 'Gateway refund was rejected',
        );
      }
      // If gatewayResult.status === 'pending', payment stays in 'refund_pending' awaiting IPN/webhook

      await this.paymentRepository.save(payment);

      return {
        refundId: refund.id,
        paymentId: payment.id.getValue(),
        orderId: payment.orderId,
        amountCents: refund.amount.toCents(),
        currency: refund.amount.getCurrency(),
        status: gatewayResult.status,
        gatewayRefundId: gatewayResult.refundId || null,
        failureReason: gatewayResult.failureReason ?? null,
        isOfflinePayout: false,
      };
    } catch (err: any) {
      this.logger.error(
        `Unexpected error during gateway refund execution: ${err.message}`,
        err.stack,
      );
      payment.failRefund(refund.id, err.message);
      await this.paymentRepository.save(payment);

      return {
        refundId: refund.id,
        paymentId: payment.id.getValue(),
        orderId: payment.orderId,
        amountCents: refund.amount.toCents(),
        currency: refund.amount.getCurrency(),
        status: 'failed',
        failureReason: err.message,
        isOfflinePayout: false,
      };
    }
  }
}
