import { Inject, Injectable } from '@nestjs/common';
import { eq } from 'drizzle-orm';

import {
  OrderPaymentPort,
  OrderPaymentSnapshot,
} from '../../application/ports/order-payment.port.js';
import {
  DRIZZLE,
  type DrizzleDB,
} from '../../../shared/infrastructure/database/postgres/drizzle.provider.js';
import { ordersSchema } from '../../../shared/infrastructure/database/postgres/schema/order.schema.js';
import { customersSchema } from '../../../shared/infrastructure/database/postgres/schema/customer.schema.js';
import { Money } from '../../../shared/domain/value-objects/money.vo.js';

@Injectable()
export class OrderPaymentAdapter implements OrderPaymentPort {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  async getOrderForPayment(
    orderId: string,
  ): Promise<OrderPaymentSnapshot | null> {
    const rows = await this.db
      .select({
        order: ordersSchema,
        customerEmail: customersSchema.email,
        customerFirstName: customersSchema.firstName,
        customerLastName: customersSchema.lastName,
        customerPhone: customersSchema.phoneNumber,
      })
      .from(ordersSchema)
      .leftJoin(
        customersSchema,
        eq(ordersSchema.customerId, customersSchema.id),
      )
      .where(eq(ordersSchema.id, orderId))
      .limit(1);

    if (rows.length === 0) {
      return null;
    }

    const row = rows[0];
    const order = row.order;

    let customerName: string | null = null;
    if (row.customerFirstName || row.customerLastName) {
      customerName =
        `${row.customerFirstName ?? ''} ${row.customerLastName ?? ''}`.trim();
    } else {
      customerName = order.recipientName;
    }

    return {
      orderId: order.id,
      customerId: order.customerId,
      status: order.status,
      totalAmount: Money.fromCents(order.totalAmount, order.totalCurrency),
      customerEmail: row.customerEmail ?? null,
      customerName,
      customerPhone: row.customerPhone ?? order.recipientPhone,
      shippingAddress: {
        recipientName: order.recipientName,
        recipientPhone: order.recipientPhone,
        addressLine: order.shippingAddressLine,
        city: order.shippingCity,
        district: order.shippingDistrict,
        division: order.shippingDivision,
        postalCode: order.shippingPostalCode,
      },
    };
  }
}
