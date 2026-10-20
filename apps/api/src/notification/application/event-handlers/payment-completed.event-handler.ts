import { Inject, Logger } from '@nestjs/common';
import { EventsHandler, IEventHandler } from '@nestjs/cqrs';
import { ConfigService } from '@nestjs/config';
import { eq } from 'drizzle-orm';

import { PaymentCompletedIntegrationEvent } from '../../../shared/contracts/events/payment-completed.event.js';
import {
  NOTIFICATION_PORT,
  type NotificationPort,
} from '../ports/notification.port.js';
import {
  DRIZZLE,
  type DrizzleDB,
} from '../../../shared/infrastructure/database/postgres/drizzle.provider.js';
import {
  ordersSchema,
  orderItemsSchema,
} from '../../../shared/infrastructure/database/postgres/schema/order.schema.js';
import { customersSchema } from '../../../shared/infrastructure/database/postgres/schema/customer.schema.js';

@EventsHandler(PaymentCompletedIntegrationEvent)
export class PaymentCompletedNotificationHandler implements IEventHandler<PaymentCompletedIntegrationEvent> {
  private readonly logger = new Logger(
    PaymentCompletedNotificationHandler.name,
  );

  constructor(
    @Inject(NOTIFICATION_PORT)
    private readonly notificationService: NotificationPort,
    @Inject(DRIZZLE)
    private readonly db: DrizzleDB,
    private readonly configService: ConfigService,
  ) {}

  async handle(event: PaymentCompletedIntegrationEvent): Promise<void> {
    this.logger.log(
      `Handling PaymentCompletedIntegrationEvent for payment: ${event.paymentId}, order: ${event.orderId}`,
    );

    // 1. Fetch Order and Customer details from DB
    const orderRows = await this.db
      .select({
        order: ordersSchema,
        customerEmail: customersSchema.email,
        customerFirstName: customersSchema.firstName,
        customerLastName: customersSchema.lastName,
      })
      .from(ordersSchema)
      .leftJoin(
        customersSchema,
        eq(ordersSchema.customerId, customersSchema.id),
      )
      .where(eq(ordersSchema.id, event.orderId))
      .limit(1);

    const orderRow = orderRows[0];
    const order = orderRow?.order;

    // Fetch ordered items
    const items = await this.db
      .select()
      .from(orderItemsSchema)
      .where(eq(orderItemsSchema.orderId, event.orderId));

    // 2. Resolve recipient email and name (prioritize customer email)
    const adminEmail =
      this.configService.get<string>('SMTP_USER') ?? 'admin@openmart.com';
    const recipientEmail =
      event.customerEmail || orderRow?.customerEmail || adminEmail;

    const customerName =
      event.customerName ||
      (orderRow?.customerFirstName
        ? `${orderRow.customerFirstName} ${orderRow.customerLastName ?? ''}`.trim()
        : null) ||
      order?.recipientName ||
      'Valued Customer';

    const amountFormatted = (event.amount / 100).toFixed(2);
    const dateFormatted = new Date(event.occurredAt).toUTCString();

    const itemsRowsHtml = items
      .map(
        (i) => `
        <tr style="border-bottom: 1px solid #f1f5f9; font-size: 14px;">
          <td style="padding: 10px 0; color: #1e293b;">
            <strong>${i.productName}</strong>
            <div style="font-size: 12px; color: #64748b;">SKU: ${i.productSku}</div>
          </td>
          <td style="padding: 10px 0; text-align: center; color: #475569;">&times; ${i.quantity}</td>
          <td style="padding: 10px 0; text-align: right; font-weight: 600; color: #0f172a;">
            $${((i.unitPriceAmount * i.quantity) / 100).toFixed(2)}
          </td>
        </tr>`,
      )
      .join('');

    const shippingAddressHtml = order
      ? `
        <div style="background-color: #f8fafc; border-radius: 8px; padding: 14px; margin-top: 16px; font-size: 13px; line-height: 1.5; color: #475569;">
          <strong style="color: #0f172a;">Shipping Address:</strong><br />
          ${order.recipientName} (${order.recipientPhone})<br />
          ${order.shippingAddressLine}, ${order.shippingArea}, ${order.shippingCity}, ${order.shippingDistrict}
        </div>
      `
      : '';

    const subject = `Payment Confirmed - Order #${event.orderId.slice(0, 8).toUpperCase()} ✅`;

    const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Payment Receipt</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f8fafc; color: #1e293b; margin: 0; padding: 24px; }
    .card { max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 12px; border: 1px solid #e2e8f0; padding: 32px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05); }
    .header { text-align: center; border-bottom: 1px solid #f1f5f9; padding-bottom: 24px; margin-bottom: 24px; }
    .badge { display: inline-block; background-color: #dcfce7; color: #15803d; font-size: 13px; font-weight: 600; padding: 4px 12px; border-radius: 9999px; }
    .amount { font-size: 32px; font-weight: 700; color: #0f172a; margin: 16px 0 8px 0; }
    .details { background-color: #f8fafc; border-radius: 8px; padding: 16px; margin: 20px 0; }
    .row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #e2e8f0; font-size: 14px; }
    .row:last-child { border-bottom: none; }
    .label { color: #64748b; }
    .val { font-weight: 600; color: #0f172a; }
    .footer { text-align: center; font-size: 12px; color: #94a3b8; margin-top: 32px; }
  </style>
</head>
<body>
  <div class="card">
    <div class="header">
      <div class="badge">Payment Confirmed</div>
      <div class="amount">$${amountFormatted} ${event.currency}</div>
      <p style="margin: 0; color: #64748b; font-size: 14px;">Hi <strong>${customerName}</strong>, thank you for your order!</p>
    </div>

    <div class="details">
      <div class="row">
        <span class="label">Order ID:</span>
        <span class="val">${event.orderId}</span>
      </div>
      <div class="row">
        <span class="label">Payment Provider:</span>
        <span class="val">${event.provider.toUpperCase()}</span>
      </div>
      <div class="row">
        <span class="label">Transaction Reference:</span>
        <span class="val">${event.transactionId}</span>
      </div>
      <div class="row">
        <span class="label">Payment Date:</span>
        <span class="val">${dateFormatted}</span>
      </div>
    </div>

    <h3 style="font-size: 16px; color: #0f172a; margin: 20px 0 8px 0;">Purchased Products:</h3>
    <table style="width: 100%; border-collapse: collapse;">
      <thead>
        <tr style="border-bottom: 2px solid #e2e8f0; font-size: 12px; text-transform: uppercase; color: #64748b;">
          <th style="text-align: left; padding: 6px 0;">Product</th>
          <th style="text-align: center; padding: 6px 0;">Qty</th>
          <th style="text-align: right; padding: 6px 0;">Subtotal</th>
        </tr>
      </thead>
      <tbody>
        ${itemsRowsHtml}
      </tbody>
    </table>

    ${shippingAddressHtml}

    <p style="font-size: 14px; line-height: 1.6; color: #475569; margin-top: 20px;">
      Your payment was received successfully and your order is now confirmed. Our packaging and fulfillment team has begun preparing your shipment. We will send you another notification once your package is on its way.
    </p>

    <div class="footer">
      OPEN-MART E-Commerce &bull; Thank you for shopping with us!
    </div>
  </div>
</body>
</html>
`;

    const text = `Hi ${customerName}, your payment of $${amountFormatted} ${event.currency} for order #${event.orderId.slice(0, 8)} is confirmed! Provider: ${event.provider.toUpperCase()}, Txn ID: ${event.transactionId}.`;

    try {
      this.logger.log(
        `Sending payment confirmation email to: ${recipientEmail}`,
      );
      await this.notificationService.sendEmail({
        to: recipientEmail,
        subject,
        html,
        text,
      });
    } catch (err: any) {
      this.logger.error(
        `Failed to send payment confirmation email to ${recipientEmail}: ${err.message}`,
        err.stack,
      );
    }
  }
}
