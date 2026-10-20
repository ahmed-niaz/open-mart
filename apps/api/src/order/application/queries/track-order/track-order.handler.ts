import { Inject } from '@nestjs/common';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { eq } from 'drizzle-orm';
import { TrackOrderQuery } from './track-order.query.js';
import {
  DRIZZLE,
  type DrizzleDB,
} from '../../../../shared/infrastructure/database/postgres/drizzle.provider.js';
import { ordersSchema } from '../../../../shared/infrastructure/database/postgres/schema/order.schema.js';
import {
  ApplicationException,
  ApplicationExceptionCode,
} from '../../../../shared/domain/exceptions/application.exception.js';
import { ShippingAddress } from '../../../domain/value-objects/shipping-address.vo.js';

export interface TrackOrderResult {
  orderId: string;
  status: string;
  courierName: string | null;
  trackingNumber: string | null;
  shippedAt: string | null;
  deliveredAt: string | null;
  createdAt: string;
}

@QueryHandler(TrackOrderQuery)
export class TrackOrderQueryHandler implements IQueryHandler<
  TrackOrderQuery,
  TrackOrderResult
> {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  async execute(query: TrackOrderQuery): Promise<TrackOrderResult> {
    const normalizedInputPhone = ShippingAddress.normalizePhone(query.phone);

    // Validate UUID format before querying DB
    const uuidRegex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(query.orderNumber.trim())) {
      throw new ApplicationException(
        'Order not found',
        ApplicationExceptionCode.NOT_FOUND,
      );
    }

    const orders = await this.db
      .select({
        id: ordersSchema.id,
        status: ordersSchema.status,
        recipientPhone: ordersSchema.recipientPhone,
        courierName: ordersSchema.courierName,
        trackingNumber: ordersSchema.trackingNumber,
        shippedAt: ordersSchema.shippedAt,
        deliveredAt: ordersSchema.deliveredAt,
        createdAt: ordersSchema.createdAt,
      })
      .from(ordersSchema)
      .where(eq(ordersSchema.id, query.orderNumber.trim()))
      .limit(1);

    if (orders.length === 0) {
      throw new ApplicationException(
        'Order not found',
        ApplicationExceptionCode.NOT_FOUND,
      );
    }

    const order = orders[0];
    const normalizedOrderPhone = ShippingAddress.normalizePhone(
      order.recipientPhone,
    );

    if (
      !normalizedInputPhone ||
      !normalizedOrderPhone ||
      normalizedInputPhone !== normalizedOrderPhone
    ) {
      // Same generic 404 for phone mismatch to prevent phone enumeration
      throw new ApplicationException(
        'Order not found',
        ApplicationExceptionCode.NOT_FOUND,
      );
    }

    return {
      orderId: order.id,
      status: order.status,
      courierName: order.courierName,
      trackingNumber: order.trackingNumber,
      shippedAt: order.shippedAt ? order.shippedAt.toISOString() : null,
      deliveredAt: order.deliveredAt ? order.deliveredAt.toISOString() : null,
      createdAt: order.createdAt.toISOString(),
    };
  }
}
