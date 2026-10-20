import { createHash } from 'node:crypto';
import { Inject, Logger } from '@nestjs/common';
import { CommandHandler, EventBus, ICommandHandler } from '@nestjs/cqrs';

import { ProcessWebhookCommand } from './process-webhook.command.js';
import {
  PAYMENT_REPOSITORY,
  type PaymentRepositoryPort,
} from '../../ports/payment.repository.js';
import { PaymentStrategyRegistry } from '../../../infrastructure/strategies/payment-strategy.registry.js';
import { PaymentCompletedIntegrationEvent } from '../../../../shared/contracts/events/payment-completed.event.js';
import { PaymentFailedIntegrationEvent } from '../../../../shared/contracts/events/payment-failed.event.js';
import { PaymentCancelledIntegrationEvent } from '../../../../shared/contracts/events/payment-cancelled.event.js';

@CommandHandler(ProcessWebhookCommand)
export class ProcessWebhookCommandHandler implements ICommandHandler<
  ProcessWebhookCommand,
  { received: boolean; processed: boolean }
> {
  private readonly logger = new Logger(ProcessWebhookCommandHandler.name);

  constructor(
    @Inject(PAYMENT_REPOSITORY)
    private readonly paymentRepository: PaymentRepositoryPort,
    private readonly strategyRegistry: PaymentStrategyRegistry,
    private readonly eventBus: EventBus,
  ) {}

  async execute(
    command: ProcessWebhookCommand,
  ): Promise<{ received: boolean; processed: boolean }> {
    const { request } = command;
    this.logger.log(
      `Processing webhook event for provider: ${request.provider}`,
    );

    // 1. Delegate signature & payload verification to Strategy
    const strategy = this.strategyRegistry.getStrategy(request.provider);
    const verification = await strategy.verifyAndParseWebhook(request);

    // Compute unique event id and payload hash
    const rawEventId =
      (verification.gatewayPayload.id as string) ||
      verification.transactionId ||
      `${request.provider}-${Date.now()}`;

    const payloadHash = request.rawBody
      ? createHash('sha256')
          .update(
            typeof request.rawBody === 'string'
              ? request.rawBody
              : Buffer.from(request.rawBody),
          )
          .digest('hex')
      : undefined;

    let integrationEventToPublish:
      | PaymentCompletedIntegrationEvent
      | PaymentFailedIntegrationEvent
      | PaymentCancelledIntegrationEvent
      | null = null;

    // 2. Atomic claim in payment_webhook_events inside the database transaction
    const processed = await this.paymentRepository.processWebhookEventAtomic(
      {
        provider: request.provider,
        eventId: rawEventId,
        eventType: verification.eventType,
        payloadHash,
      },
      async (txRepo) => {
        // Find payment by gateway transaction ID first, fallback to orderId
        let payment = await txRepo.findByTransactionId(
          verification.transactionId,
        );

        if (!payment && verification.orderId) {
          payment = await txRepo.findByOrderId(verification.orderId);
        }

        if (!payment) {
          this.logger.warn(
            `No payment record found for transactionId '${verification.transactionId}' or orderId '${verification.orderId}'. Webhook logged without state mutation.`,
          );
          return;
        }

        if (verification.eventType === 'payment.succeeded') {
          // Verify amount and currency
          const matchesAmount =
            payment.amount.toCents() === verification.amount.toCents();
          const matchesCurrency =
            payment.amount.getCurrency() === verification.amount.getCurrency();

          if (!matchesAmount || !matchesCurrency) {
            this.logger.warn(
              `Payment verification mismatch on ${payment.id.getValue()}: expected ${payment.amount.toCents()} ${payment.amount.getCurrency()}, received ${verification.amount.toCents()} ${verification.amount.getCurrency()}`,
            );
            payment.markNeedsReview(
              `Amount or currency mismatch from gateway webhook. Expected ${payment.amount.toCents()} ${payment.amount.getCurrency()}, received ${verification.amount.toCents()} ${verification.amount.getCurrency()}`,
              verification.amount,
            );
          } else if (payment.status.isCompleted()) {
            this.logger.log(
              `Payment ${payment.id.getValue()} is already completed. Skipping redundant update.`,
            );
            return;
          } else if (
            payment.status.isCancelled() ||
            payment.status.isFailed()
          ) {
            this.logger.warn(
              `Payment succeeded for order ${payment.orderId}, but local payment is already in status '${payment.status.getValue()}'. Flagging for review.`,
            );
            payment.markNeedsReview(
              `Payment succeeded at gateway, but local payment is '${payment.status.getValue()}'`,
              verification.amount,
            );
          } else {
            payment.complete(verification.transactionId);
            const customerEmail =
              (payment.metadata?.customerEmail as string) || null;
            const customerName =
              (payment.metadata?.customerName as string) || null;

            integrationEventToPublish = new PaymentCompletedIntegrationEvent(
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
            );
          }
        } else if (verification.eventType === 'payment.failed') {
          if (payment.status.isPending() || payment.status.isProcessing()) {
            payment.fail(
              verification.failureReason ||
                'Gateway marked transaction as failed',
              verification.failureCode,
            );
            const customerEmail =
              (payment.metadata?.customerEmail as string) || null;
            const customerName =
              (payment.metadata?.customerName as string) || null;

            integrationEventToPublish = new PaymentFailedIntegrationEvent(
              payment.id.getValue(),
              payment.orderId,
              payment.customerId,
              payment.provider.getValue(),
              verification.failureReason || 'Gateway payment failed',
              verification.failureCode,
              customerEmail,
              customerName,
              new Date(),
            );
          }
        } else if (verification.eventType === 'payment.cancelled') {
          if (payment.status.isPending() || payment.status.isProcessing()) {
            payment.cancel(
              verification.failureReason ||
                'Cancelled by gateway callback/webhook',
            );
            const customerEmail =
              (payment.metadata?.customerEmail as string) || null;
            const customerName =
              (payment.metadata?.customerName as string) || null;

            integrationEventToPublish = new PaymentCancelledIntegrationEvent(
              payment.id.getValue(),
              payment.orderId,
              payment.customerId,
              payment.provider.getValue(),
              verification.failureReason ||
                'Cancelled by gateway callback/webhook',
              customerEmail,
              customerName,
              new Date(),
            );
          }
        }

        await txRepo.save(payment);
      },
    );

    if (!processed) {
      this.logger.log(
        `Duplicate webhook event ${rawEventId} for provider ${request.provider} ignored (idempotent 200)`,
      );
      return { received: true, processed: false };
    }

    // Publish integration event to CQRS EventBus outside the DB transaction
    if (integrationEventToPublish) {
      this.eventBus.publish(integrationEventToPublish);
    }

    return { received: true, processed: true };
  }
}
