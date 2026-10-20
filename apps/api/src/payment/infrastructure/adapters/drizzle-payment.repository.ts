import { randomUUID } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import { EventPublisher } from '@nestjs/cqrs';
import { and, desc, eq } from 'drizzle-orm';

import { PaymentRepositoryPort } from '../../application/ports/payment.repository.js';
import { Payment } from '../../domain/entities/payment.entity.js';
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
  paymentWebhookEventsSchema,
} from '../../../shared/infrastructure/database/postgres/schema/payment.schema.js';
import {
  ApplicationException,
  ApplicationExceptionCode,
} from '../../../shared/domain/exceptions/application.exception.js';

@Injectable()
export class DrizzlePaymentRepository implements PaymentRepositoryPort {
  constructor(
    @Inject(DRIZZLE) private readonly db: DrizzleDB,
    private readonly eventPublisher: EventPublisher,
  ) {}

  async save(payment: Payment): Promise<void> {
    const existing = await this.db
      .select({ id: paymentsSchema.id, version: paymentsSchema.version })
      .from(paymentsSchema)
      .where(eq(paymentsSchema.id, payment.id.getValue()))
      .limit(1);

    if (existing.length === 0) {
      await this.db.insert(paymentsSchema).values({
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

      const updated = await this.db
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

    this.eventPublisher.mergeObjectContext(payment).commit();
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
    return this.toDomain(rows[0]);
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
    return this.toDomain(rows[0]);
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
    return this.toDomain(rows[0]);
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
      );
      await action(txRepo);
      return true;
    });
  }

  private toDomain(row: typeof paymentsSchema.$inferSelect): Payment {
    const amount = Money.fromCents(row.amount, row.currency);
    const refundedAmount = Money.fromCents(row.refundedAmount, row.currency);

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
    });
  }
}
