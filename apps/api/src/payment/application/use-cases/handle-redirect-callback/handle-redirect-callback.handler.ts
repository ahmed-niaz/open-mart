import { Inject, Logger } from '@nestjs/common';
import { CommandBus, CommandHandler, EventBus, ICommandHandler } from '@nestjs/cqrs';

import { HandleRedirectCallbackCommand } from './handle-redirect-callback.command.js';
import {
  PAYMENT_REPOSITORY,
  type PaymentRepositoryPort,
} from '../../ports/payment.repository.js';
import { PaymentStrategyRegistry } from '../../../infrastructure/strategies/payment-strategy.registry.js';
import { PaymentCompletedIntegrationEvent } from '../../../../shared/contracts/events/payment-completed.event.js';
import { PaymentFailedIntegrationEvent } from '../../../../shared/contracts/events/payment-failed.event.js';
import { PaymentCancelledIntegrationEvent } from '../../../../shared/contracts/events/payment-cancelled.event.js';
import { ConfirmOrderCommand } from '../../../../order/application/use-cases/confirm-order/confirm-order.command.js';
import { PaymentId } from '../../../domain/value-objects/payment-id.vo.js';
import {
  ApplicationException,
  ApplicationExceptionCode,
} from '../../../../shared/domain/exceptions/application.exception.js';

export interface RedirectCallbackResult {
  success: boolean;
  orderId: string;
  transactionId?: string;
  reason?: string;
  isCancelled?: boolean;
}

@CommandHandler(HandleRedirectCallbackCommand)
export class HandleRedirectCallbackCommandHandler
  implements
    ICommandHandler<HandleRedirectCallbackCommand, RedirectCallbackResult>
{
  private readonly logger = new Logger(
    HandleRedirectCallbackCommandHandler.name,
  );

  constructor(
    @Inject(PAYMENT_REPOSITORY)
    private readonly paymentRepository: PaymentRepositoryPort,
    private readonly strategyRegistry: PaymentStrategyRegistry,
    private readonly eventBus: EventBus,
    private readonly commandBus: CommandBus,
  ) {}

  async execute(
    command: HandleRedirectCallbackCommand,
  ): Promise<RedirectCallbackResult> {
    const { provider, payload } = command;
    this.logger.log(`Handling redirect callback for provider: ${provider}`);

    const strategy = this.strategyRegistry.getStrategy(provider);
    if (!strategy.validateRedirect) {
      throw new ApplicationException(
        `Provider '${provider}' does not support redirect callback validation`,
        ApplicationExceptionCode.VALIDATION_ERROR,
      );
    }

    const verification = await strategy.validateRedirect(payload);

    // Multi-key payment lookup for bulletproof resolution
    let payment = await this.paymentRepository.findByTransactionId(
      verification.transactionId,
    );

    // Try payload tran_id (our paymentId passed at initiation)
    if (!payment && payload.tran_id) {
      payment = await this.paymentRepository.findByTransactionId(payload.tran_id);
      if (!payment) {
        try {
          payment = await this.paymentRepository.findById(
            PaymentId.fromString(payload.tran_id),
          );
        } catch {
          // not a valid UUID
        }
      }
    }

    // Try orderId from verification or payload
    const orderIdToLookup =
      verification.orderId || payload.value_a || payload.order_id;
    if (!payment && orderIdToLookup) {
      payment = await this.paymentRepository.findByOrderId(orderIdToLookup);
    }

    if (!payment) {
      this.logger.warn(
        `Redirect callback received for unknown payment. Txn: ${verification.transactionId}, Order: ${orderIdToLookup}`,
      );
      return {
        success: false,
        orderId: orderIdToLookup || '',
        transactionId: verification.transactionId,
        reason: 'Payment not found',
      };
    }

    if (verification.eventType === 'payment.succeeded') {
      // Check currency/amount tolerance (SSLCommerz may convert foreign USD to BDT in sandbox)
      const valRes = (verification.gatewayPayload?.validationResponse as any) || {};
      const matchesCurrency =
        payment.amount.getCurrency() === verification.amount.getCurrency() ||
        valRes.currency_type === payment.amount.getCurrency();

      const matchesAmount =
        payment.amount.toCents() === verification.amount.toCents() ||
        valRes.currency_amount == (payment.amount.toCents() / 100).toFixed(2);

      if (!matchesAmount || !matchesCurrency) {
        this.logger.warn(
          `Payment amount/currency check on ${payment.id.getValue()}: expected ${payment.amount.toCents()} ${payment.amount.getCurrency()}, received ${verification.amount.toCents()} ${verification.amount.getCurrency()}`,
        );
        payment.markNeedsReview(
          `Amount or currency mismatch during redirect callback. Expected ${payment.amount.toCents()} ${payment.amount.getCurrency()}, received ${verification.amount.toCents()} ${verification.amount.getCurrency()}`,
          verification.amount,
        );
        await this.paymentRepository.save(payment);
      } else if (!payment.status.isCompleted()) {
        payment.complete(verification.transactionId);
        await this.paymentRepository.save(payment);

        // Guarantee immediate order confirmation
        try {
          await this.commandBus.execute(new ConfirmOrderCommand(payment.orderId));
          this.logger.log(`Order ${payment.orderId} confirmed via CommandBus!`);
        } catch (err: any) {
          this.logger.error(
            `Error executing ConfirmOrderCommand: ${err.message}`,
            err.stack,
          );
        }

        const customerEmail =
          (payload.cus_email as string) ||
          (payment.metadata?.customerEmail as string) ||
          null;
        const customerName =
          (payload.cus_name as string) ||
          (payment.metadata?.customerName as string) ||
          null;

        // Publish event for email receipt
        this.eventBus.publish(
          new PaymentCompletedIntegrationEvent(
            payment.id.getValue(),
            payment.orderId,
            payment.customerId,
            payment.provider.getValue(),
            payment.transactionId || verification.transactionId,
            payment.amount.toCents(),
            payment.amount.getCurrency(),
            customerEmail,
            customerName,
            payment.paidAt || new Date(),
          ),
        );
      } else {
        // If already completed, ensure order is confirmed
        await this.commandBus.execute(new ConfirmOrderCommand(payment.orderId));
      }

      return {
        success: true,
        orderId: payment.orderId,
        transactionId: payment.transactionId || verification.transactionId,
      };
    } else if (verification.eventType === 'payment.cancelled') {
      const customerEmail =
        (payload.cus_email as string) ||
        (payment.metadata?.customerEmail as string) ||
        null;
      const customerName =
        (payload.cus_name as string) ||
        (payment.metadata?.customerName as string) ||
        null;

      if (payment.status.isPending() || payment.status.isProcessing()) {
        payment.cancel(
          verification.failureReason || 'Customer cancelled payment during redirect',
        );
        await this.paymentRepository.save(payment);

        this.eventBus.publish(
          new PaymentCancelledIntegrationEvent(
            payment.id.getValue(),
            payment.orderId,
            payment.customerId,
            payment.provider.getValue(),
            verification.failureReason || 'Customer cancelled payment during redirect',
            customerEmail,
            customerName,
            new Date(),
          ),
        );
      }

      return {
        success: false,
        isCancelled: true,
        orderId: payment.orderId,
        transactionId: payment.transactionId || verification.transactionId,
        reason: verification.failureReason || 'Payment cancelled by customer',
      };
    } else {
      const customerEmail =
        (payload.cus_email as string) ||
        (payment.metadata?.customerEmail as string) ||
        null;
      const customerName =
        (payload.cus_name as string) ||
        (payment.metadata?.customerName as string) ||
        null;

      if (payment.status.isPending() || payment.status.isProcessing()) {
        payment.fail(
          verification.failureReason || 'Payment failed during redirect',
          verification.failureCode,
        );
        await this.paymentRepository.save(payment);

        this.eventBus.publish(
          new PaymentFailedIntegrationEvent(
            payment.id.getValue(),
            payment.orderId,
            payment.customerId,
            payment.provider.getValue(),
            verification.failureReason || 'Payment failed during redirect',
            verification.failureCode,
            customerEmail,
            customerName,
            new Date(),
          ),
        );
      }

      return {
        success: false,
        orderId: payment.orderId,
        transactionId: payment.transactionId || verification.transactionId,
        reason: verification.failureReason,
      };
    }
  }
}
