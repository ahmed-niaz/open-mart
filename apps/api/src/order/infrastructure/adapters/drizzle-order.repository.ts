import { randomUUID } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import { EventPublisher } from '@nestjs/cqrs';
import { and, eq } from 'drizzle-orm';
import { OrderRepositoryPort } from '../../application/ports/order.repository.js';
import { Order } from '../../domain/entities/order.entity.js';
import { OrderId } from '../../domain/value-objects/order-id.vo.js';
import { OrderItemId } from '../../domain/value-objects/order-item-id.vo.js';
import { OrderStatus } from '../../domain/value-objects/order-status.vo.js';
import { ShippingAddress } from '../../domain/value-objects/shipping-address.vo.js';
import { OrderItem } from '../../domain/entities/order-item.entity.js';
import { Money } from '../../../shared/domain/value-objects/money.vo.js';
import {
  DRIZZLE,
  type DrizzleDB,
} from '../../../shared/infrastructure/database/postgres/drizzle.provider.js';
import {
  orderItemsSchema,
  ordersSchema,
  orderStatusHistorySchema,
  type OrderItemInsertRow,
  type OrderItemSelectRow,
  type OrderInsertRow,
  type OrderSelectRow,
} from '../../../shared/infrastructure/database/postgres/schema/order.schema.js';
import {
  ApplicationException,
  ApplicationExceptionCode,
} from '../../../shared/domain/exceptions/application.exception.js';
import { OutboxService } from '../../../shared/infrastructure/outbox/outbox.service.js';
import { IdempotencyService } from '../../../shared/infrastructure/idempotency/idempotency.service.js';
import type { OrderIdempotencyContext } from '../../application/ports/order.repository.js';

@Injectable()
export class DrizzleOrderRepository implements OrderRepositoryPort {
  constructor(
    @Inject(DRIZZLE) private readonly db: DrizzleDB,
    private readonly eventPublisher: EventPublisher,
    private readonly outboxService: OutboxService,
    private readonly idempotencyService: IdempotencyService,
  ) {}

  async findById(id: OrderId): Promise<Order | null> {
    const orders = await this.db
      .select()
      .from(ordersSchema)
      .where(eq(ordersSchema.id, id.getValue()))
      .limit(1);

    if (orders.length === 0) {
      return null;
    }

    const orderRow = orders[0];

    const itemRows = await this.db
      .select()
      .from(orderItemsSchema)
      .where(eq(orderItemsSchema.orderId, id.getValue()));

    return this.toDomain(orderRow, itemRows);
  }

  async save(
    order: Order,
    idempotency?: OrderIdempotencyContext,
  ): Promise<void> {
    await this.db.transaction(async (trx) => {
      const existing = await trx
        .select({
          id: ordersSchema.id,
          version: ordersSchema.version,
          status: ordersSchema.status,
        })
        .from(ordersSchema)
        .where(eq(ordersSchema.id, order.id.getValue()))
        .limit(1);

      if (existing.length === 0) {
        // Insert new order
        const orderRow = this.toOrderPersistence(order);
        await trx.insert(ordersSchema).values(orderRow);

        // Insert items
        const itemRows = order.items.map((item) =>
          this.toOrderItemPersistence(item, order.id.getValue()),
        );
        if (itemRows.length > 0) {
          await trx.insert(orderItemsSchema).values(itemRows);
        }

        // Audit status history: initial pending status
        await trx.insert(orderStatusHistorySchema).values({
          id: randomUUID(),
          orderId: order.id.getValue(),
          fromStatus: null,
          toStatus: order.status.getValue(),
          changedBy: order.customerId ?? 'customer',
          reason: order.notes ?? 'Order placed',
          changedAt: order.createdAt,
        });
      } else {
        // OCC Update: enforce atomic version matching
        const currentVersion = order.version;
        const nextVersion = currentVersion + 1;
        const previousStatus = existing[0].status;

        const addr = order.shippingAddress;
        const updated = await trx
          .update(ordersSchema)
          .set({
            status: order.status.getValue(),
            subtotalAmount: order.getSubtotalAmount().toCents(),
            shippingFeeAmount: order.getShippingFeeAmount().toCents(),
            shippingFeeDiscountAmount: order
              .getShippingFeeDiscountAmount()
              .toCents(),
            taxAmount: order.getTaxAmount().toCents(),
            totalAmount: order.getTotalAmount().toCents(),
            totalCurrency: order.getTotalAmount().getCurrency(),
            recipientName: addr.recipientName,
            recipientPhone: addr.recipientPhone,
            altPhone: addr.altPhone,
            shippingDivision: addr.division,
            shippingDistrict: addr.district,
            shippingCity: addr.city,
            shippingArea: addr.area,
            shippingAddressLine: addr.addressLine,
            shippingPostalCode: addr.postalCode,
            shippingCountry: addr.country,
            courierName: order.courierName,
            trackingNumber: order.trackingNumber,
            notes: order.notes,
            shippedAt: order.shippedAt,
            deliveredAt: order.deliveredAt,
            cancelledAt: order.cancelledAt,
            cancellationReason: order.cancellationReason,
            version: nextVersion,
            updatedAt: order.updatedAt,
          })
          .where(
            and(
              eq(ordersSchema.id, order.id.getValue()),
              eq(ordersSchema.version, currentVersion),
            ),
          )
          .returning({ id: ordersSchema.id });

        if (updated.length === 0) {
          throw new ApplicationException(
            `Optimistic lock failure: Order '${order.id.getValue()}' was modified concurrently by another process.`,
            ApplicationExceptionCode.CONFLICT,
          );
        }

        // Audit status history on state transitions
        if (previousStatus !== order.status.getValue()) {
          await trx.insert(orderStatusHistorySchema).values({
            id: randomUUID(),
            orderId: order.id.getValue(),
            fromStatus: previousStatus,
            toStatus: order.status.getValue(),
            changedBy: order.customerId ?? 'system',
            reason: order.cancellationReason ?? null,
            changedAt: new Date(),
          });
        }

        order.incrementVersion();
      }

      // Stage uncommitted domain events to Outbox table atomically inside the transaction
      const uncommittedEvents = order.getUncommittedEvents();
      if (uncommittedEvents.length > 0) {
        await this.outboxService.stageEvents(
          trx,
          'Order',
          order.id.getValue(),
          uncommittedEvents,
        );
      }

      // Write idempotency record atomically within the same database transaction
      if (idempotency) {
        await this.idempotencyService.recordCompleted(
          trx,
          idempotency.key,
          idempotency.scope,
          idempotency.requestPath,
          idempotency.payload,
          201,
          idempotency.responseBody,
        );
      }
    });

    order.clearEvents();
    this.outboxService.triggerSweep();
  }

  private toDomain(
    orderRow: OrderSelectRow,
    itemRows: OrderItemSelectRow[],
  ): Order {
    const items = itemRows.map((row) =>
      OrderItem.reconstitute({
        id: OrderItemId.fromString(row.id),
        productId: row.productId ?? '',
        productName: row.productName,
        productSku: row.productSku,
        unitPrice: Money.fromCents(row.unitPriceAmount, row.unitPriceCurrency),
        quantity: row.quantity,
        discountAmount: Money.fromCents(
          row.discountAmount ?? 0,
          row.unitPriceCurrency,
        ),
      }),
    );

    const shippingAddress = ShippingAddress.create({
      recipientName: orderRow.recipientName,
      recipientPhone: orderRow.recipientPhone,
      altPhone: orderRow.altPhone,
      division: orderRow.shippingDivision,
      district: orderRow.shippingDistrict,
      city: orderRow.shippingCity,
      area: orderRow.shippingArea,
      addressLine: orderRow.shippingAddressLine,
      postalCode: orderRow.shippingPostalCode,
      country: orderRow.shippingCountry,
    });

    return Order.reconstitute({
      id: OrderId.fromString(orderRow.id),
      customerId: orderRow.customerId,
      status: OrderStatus.fromString(orderRow.status),
      items,
      shippingAddress,
      courierName: orderRow.courierName,
      trackingNumber: orderRow.trackingNumber,
      notes: orderRow.notes,
      shippedAt: orderRow.shippedAt,
      deliveredAt: orderRow.deliveredAt,
      cancelledAt: orderRow.cancelledAt,
      cancellationReason: orderRow.cancellationReason,
      discountCode: orderRow.discountCode,
      discountType: orderRow.discountType,
      discountAmount: orderRow.discountAmount
        ? Money.fromCents(orderRow.discountAmount, orderRow.totalCurrency)
        : Money.zero(orderRow.totalCurrency),
      subtotalAmount: orderRow.subtotalAmount
        ? Money.fromCents(orderRow.subtotalAmount, orderRow.totalCurrency)
        : Money.zero(orderRow.totalCurrency),
      shippingFeeAmount: orderRow.shippingFeeAmount
        ? Money.fromCents(orderRow.shippingFeeAmount, orderRow.totalCurrency)
        : Money.zero(orderRow.totalCurrency),
      shippingFeeDiscountAmount: orderRow.shippingFeeDiscountAmount
        ? Money.fromCents(
            orderRow.shippingFeeDiscountAmount,
            orderRow.totalCurrency,
          )
        : Money.zero(orderRow.totalCurrency),
      taxAmount: orderRow.taxAmount
        ? Money.fromCents(orderRow.taxAmount, orderRow.totalCurrency)
        : Money.zero(orderRow.totalCurrency),
      version: orderRow.version,
      createdAt: orderRow.createdAt,
      updatedAt: orderRow.updatedAt,
    });
  }

  private toOrderPersistence(order: Order): OrderInsertRow {
    const addr = order.shippingAddress;
    return {
      id: order.id.getValue(),
      customerId: order.customerId,
      status: order.status.getValue(),
      subtotalAmount: order.getSubtotalAmount().toCents(),
      shippingFeeAmount: order.getShippingFeeAmount().toCents(),
      shippingFeeDiscountAmount: order.getShippingFeeDiscountAmount().toCents(),
      taxAmount: order.getTaxAmount().toCents(),
      totalAmount: order.getTotalAmount().toCents(),
      totalCurrency: order.getTotalAmount().getCurrency(),
      recipientName: addr.recipientName,
      recipientPhone: addr.recipientPhone,
      altPhone: addr.altPhone,
      shippingDivision: addr.division,
      shippingDistrict: addr.district,
      shippingCity: addr.city,
      shippingArea: addr.area,
      shippingAddressLine: addr.addressLine,
      shippingPostalCode: addr.postalCode,
      shippingCountry: addr.country,
      courierName: order.courierName,
      trackingNumber: order.trackingNumber,
      notes: order.notes,
      shippedAt: order.shippedAt,
      deliveredAt: order.deliveredAt,
      cancelledAt: order.cancelledAt,
      cancellationReason: order.cancellationReason,
      discountCode: order.discountCode ?? null,
      discountType: order.discountType ?? null,
      discountAmount: order.discountAmount ? order.discountAmount.toCents() : 0,
      version: order.version,
      createdAt: order.createdAt,
      updatedAt: order.updatedAt,
    };
  }

  private toOrderItemPersistence(
    item: OrderItem,
    orderId: string,
  ): OrderItemInsertRow {
    return {
      id: item.id.getValue(),
      orderId,
      productId: item.productId,
      productName: item.productName,
      productSku: item.productSku,
      unitPriceAmount: item.unitPrice.toCents(),
      unitPriceCurrency: item.unitPrice.getCurrency(),
      quantity: item.quantity,
      discountAmount: item.discountAmount ? item.discountAmount.toCents() : 0,
      createdAt: new Date(),
    };
  }
}
