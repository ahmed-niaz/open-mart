import { randomUUID } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import { EventPublisher } from '@nestjs/cqrs';
import { and, desc, eq } from 'drizzle-orm';

import { PaymentRepositoryPort } from '../../application/ports/payment.repository.js';
import { Payment } from '../../domain/entities/payment.entity.js';
import {
  PaymentRefund,
  type RefundStatus,
} from '../../domain/entities/payment-refund.entity.js';
import { PaymentId } from '../../domain/value-objects/payment-id.vo.js';
import { PaymentProvider } from '../../domain/value-objects/payment-provider.vo.js';
import { PaymentStatus } from '../../domain/value-objects/payment-status.vo.js';
import { Money } from '../../../shared/domain/value-objects/money.vo.js';
import {
  DRIZZLE,
  type DrizzleDB,
} from '../../../shared/infrastructure/database/postgres/drizzle.provider.js';
import {
  paymentsSchema,
  paymentRefundsSchema,
  paymentWebhookEventsSchema,
} from '../../../shared/infrastructure/database/postgres/schema/payment.schema.js';
import {
  ApplicationException,
  ApplicationExceptionCode,
} from '../../../shared/domain/exceptions/application.exception.js';
import { OutboxService } from '../../../shared/infrastructure/outbox/outbox.service.js';

@Injectable()
export class DrizzlePaymentRepository implements PaymentRepositoryPort {
  constructor(
    @Inject(DRIZZLE) private readonly db: DrizzleDB,
    private readonly eventPublisher: EventPublisher,
    private readonly outboxService: OutboxService,
  ) {}

  async save(payment: Payment): Promise<void> {
    await this.db.transaction(async (trx) => {
      const existing = await trx
        .select({ id: paymentsSchema.id, version: paymentsSchema.version })
        .from(paymentsSchema)
        .where(eq(paymentsSchema.id, payment.id.getValue()))
        .limit(1);

      if (existing.length === 0) {
        await trx.insert(paymentsSchema).values({
          id: payment.id.getValue(),
          orderId: payment.orderId,
          customerId: payment.customerId,
          provider: payment.provider.getValue(),
          status: payment.status.getValue(),
          amount: payment.amount.toCents(),
          currency: payment.amount.getCurrency(),
          transactionId: payment.transactionId,
          idempotencyKey: payment.idempotencyKey,
          failureCode: payment.failureCode,
          failureReason: payment.failureReason,
          providerRefundId: payment.providerRefundId,
          refundedAmount: payment.refundedAmount.toCents(),
          paidAt: payment.paidAt,
          metadata: payment.metadata,
          version: payment.version,
          createdAt: payment.createdAt,
          updatedAt: payment.updatedAt,
        });
      } else {
        const currentVersion = payment.version;
        payment.incrementVersion();
        const nextVersion = payment.version;

        const updated = await trx
          .update(paymentsSchema)
          .set({
            status: payment.status.getValue(),
            amount: payment.amount.toCents(),
            currency: payment.amount.getCurrency(),
            transactionId: payment.transactionId,
            idempotencyKey: payment.idempotencyKey,
            failureCode: payment.failureCode,
            failureReason: payment.failureReason,
            providerRefundId: payment.providerRefundId,
            refundedAmount: payment.refundedAmount.toCents(),
            paidAt: payment.paidAt,
            metadata: payment.metadata,
            version: nextVersion,
            updatedAt: new Date(),
          })
          .where(
            and(
              eq(paymentsSchema.id, payment.id.getValue()),
              eq(paymentsSchema.version, currentVersion),
            ),
          )
          .returning({ id: paymentsSchema.id });

        if (updated.length === 0) {
          throw new ApplicationException(
            `Payment '${payment.id.getValue()}' was modified by another transaction. Concurrency conflict.`,
            ApplicationExceptionCode.CONFLICT,
          );
        }
      }

      // Sync refund records in the same transaction
      for (const refund of payment.refunds) {
        const existingRefund = await trx
          .select({ id: paymentRefundsSchema.id })
          .from(paymentRefundsSchema)
          .where(eq(paymentRefundsSchema.id, refund.id))
          .limit(1);

        if (existingRefund.length === 0) {
          await trx.insert(paymentRefundsSchema).values({
            id: refund.id,
            paymentId: refund.paymentId,
            orderId: refund.orderId,
            amount: refund.amount.toCents(),
            currency: refund.amount.getCurrency(),
            reason: refund.reason,
            status: refund.status,
            gatewayRefundId: refund.gatewayRefundId,
            isOfflinePayout: refund.isOfflinePayout,
            offlineReference: refund.offlineReference,
            failureReason: refund.failureReason,
            initiatedBy: refund.initiatedBy,
            createdAt: refund.createdAt,
            completedAt: refund.completedAt,
          });
        } else {
          await trx
            .update(paymentRefundsSchema)
            .set({
              status: refund.status,
              gatewayRefundId: refund.gatewayRefundId,
              offlineReference: refund.offlineReference,
              failureReason: refund.failureReason,
              completedAt: refund.completedAt,
            })
            .where(eq(paymentRefundsSchema.id, refund.id));
        }
      }

      const uncommittedEvents = payment.getUncommittedEvents();
      if (uncommittedEvents.length > 0) {
        await this.outboxService.stageEvents(
          trx,
          'Payment',
          payment.id.getValue(),
          uncommittedEvents,
        );
      }
    });

    payment.clearEvents();
    this.outboxService.triggerSweep();
  }

  async findById(id: PaymentId): Promise<Payment | null> {
    const rows = await this.db
      .select()
      .from(paymentsSchema)
      .where(eq(paymentsSchema.id, id.getValue()))
      .limit(1);

    if (rows.length === 0) {
      return null;
    }

    const refundRows = await this.db
      .select()
      .from(paymentRefundsSchema)
      .where(eq(paymentRefundsSchema.paymentId, id.getValue()))
      .orderBy(desc(paymentRefundsSchema.createdAt));

    return this.toDomain(rows[0], refundRows);
  }

  async findByOrderId(orderId: string): Promise<Payment | null> {
    const rows = await this.db
      .select()
      .from(paymentsSchema)
      .where(eq(paymentsSchema.orderId, orderId))
      .orderBy(desc(paymentsSchema.createdAt))
      .limit(1);

    if (rows.length === 0) {
      return null;
    }

    const refundRows = await this.db
      .select()
      .from(paymentRefundsSchema)
      .where(eq(paymentRefundsSchema.paymentId, rows[0].id))
      .orderBy(desc(paymentRefundsSchema.createdAt));

    return this.toDomain(rows[0], refundRows);
  }

  async findByTransactionId(transactionId: string): Promise<Payment | null> {
    const rows = await this.db
      .select()
      .from(paymentsSchema)
      .where(eq(paymentsSchema.transactionId, transactionId))
      .limit(1);

    if (rows.length === 0) {
      return null;
    }

    const refundRows = await this.db
      .select()
      .from(paymentRefundsSchema)
      .where(eq(paymentRefundsSchema.paymentId, rows[0].id))
      .orderBy(desc(paymentRefundsSchema.createdAt));

    return this.toDomain(rows[0], refundRows);
  }

  async findRefundsByPaymentId(paymentId: PaymentId): Promise<PaymentRefund[]> {
    const rows = await this.db
      .select()
      .from(paymentRefundsSchema)
      .where(eq(paymentRefundsSchema.paymentId, paymentId.getValue()))
      .orderBy(desc(paymentRefundsSchema.createdAt));

    return rows.map((r) => this.refundToDomain(r));
  }

  async findRefundsByOrderId(orderId: string): Promise<PaymentRefund[]> {
    const rows = await this.db
      .select()
      .from(paymentRefundsSchema)
      .where(eq(paymentRefundsSchema.orderId, orderId))
      .orderBy(desc(paymentRefundsSchema.createdAt));

    return rows.map((r) => this.refundToDomain(r));
  }

  async processWebhookEventAtomic(
    event: {
      provider: 'stripe' | 'cod' | 'sslcommerz';
      eventId: string;
      eventType: string;
      payloadHash?: string;
    },
    action: (txRepo: PaymentRepositoryPort) => Promise<void>,
  ): Promise<boolean> {
    return this.db.transaction(async (tx) => {
      const inserted = await tx
        .insert(paymentWebhookEventsSchema)
        .values({
          id: randomUUID(),
          provider: event.provider,
          eventId: event.eventId,
          eventType: event.eventType,
          payloadHash: event.payloadHash,
        })
        .onConflictDoNothing()
        .returning({ id: paymentWebhookEventsSchema.id });

      if (inserted.length === 0) {
        return false; // Already processed
      }

      const txRepo = new DrizzlePaymentRepository(
        tx as unknown as DrizzleDB,
        this.eventPublisher,
        this.outboxService,
      );
      await action(txRepo);
      return true;
    });
  }

  private toDomain(
    row: typeof paymentsSchema.$inferSelect,
    refundRows: (typeof paymentRefundsSchema.$inferSelect)[] = [],
  ): Payment {
    const amount = Money.fromCents(row.amount, row.currency);
    const refundedAmount = Money.fromCents(row.refundedAmount, row.currency);
    const refunds = refundRows.map((r) => this.refundToDomain(r));

    return Payment.reconstitute({
      id: PaymentId.fromString(row.id),
      orderId: row.orderId,
      customerId: row.customerId,
      provider: PaymentProvider.fromString(row.provider),
      status: PaymentStatus.fromString(row.status),
      amount,
      transactionId: row.transactionId,
      idempotencyKey: row.idempotencyKey,
      failureCode: row.failureCode,
      failureReason: row.failureReason,
      providerRefundId: row.providerRefundId,
      refundedAmount,
      paidAt: row.paidAt,
      metadata: (row.metadata as Record<string, unknown>) ?? null,
      version: row.version,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      refunds,
    });
  }

  private refundToDomain(
    row: typeof paymentRefundsSchema.$inferSelect,
  ): PaymentRefund {
    return PaymentRefund.reconstitute({
      id: row.id,
      paymentId: row.paymentId,
      orderId: row.orderId,
      amount: Money.fromCents(row.amount, row.currency),
      reason: row.reason,
      status: row.status as RefundStatus,
      gatewayRefundId: row.gatewayRefundId,
      isOfflinePayout: row.isOfflinePayout,
      offlineReference: row.offlineReference,
      failureReason: row.failureReason,
      initiatedBy: row.initiatedBy,
      createdAt: row.createdAt,
      completedAt: row.completedAt,
    });
  }
}
