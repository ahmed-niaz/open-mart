import { Inject, Logger } from '@nestjs/common';
import { EventsHandler, IEventHandler } from '@nestjs/cqrs';
import { ConfigService } from '@nestjs/config';
import { eq } from 'drizzle-orm';

import { PaymentFailedIntegrationEvent } from '../../../shared/contracts/events/payment-failed.event.js';
import {
  NOTIFICATION_PORT,
  type NotificationPort,
} from '../ports/notification.port.js';
import {
  DRIZZLE,
  type DrizzleDB,
} from '../../../shared/infrastructure/database/postgres/drizzle.provider.js';
import { ordersSchema } from '../../../shared/infrastructure/database/postgres/schema/order.schema.js';
import { customersSchema } from '../../../shared/infrastructure/database/postgres/schema/customer.schema.js';

@EventsHandler(PaymentFailedIntegrationEvent)
export class PaymentFailedNotificationHandler implements IEventHandler<PaymentFailedIntegrationEvent> {
  private readonly logger = new Logger(PaymentFailedNotificationHandler.name);

  constructor(
    @Inject(NOTIFICATION_PORT)
    private readonly notificationService: NotificationPort,
    @Inject(DRIZZLE)
    private readonly db: DrizzleDB,
    private readonly configService: ConfigService,
  ) {}

  async handle(event: PaymentFailedIntegrationEvent): Promise<void> {
    this.logger.log(
      `Handling PaymentFailedIntegrationEvent for payment: ${event.paymentId}, order: ${event.orderId}`,
    );

    // 1. Fetch Order and Customer details from DB if needed
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

    // 2. Resolve recipient email and greeting name
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

    const frontendUrl =
      this.configService.get<string>('FRONTEND_URL') ?? 'http://localhost:3000';
    const retryUrl = `${frontendUrl}/checkout?order_id=${event.orderId}`;

    const subject = `Payment Unsuccessful - Order #${event.orderId.slice(0, 8).toUpperCase()} ⚠️`;

    const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Payment Failed</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f8fafc; color: #1e293b; margin: 0; padding: 24px; }
    .card { max-width: 580px; margin: 0 auto; background: #ffffff; border-radius: 12px; border: 1px solid #fee2e2; padding: 32px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05); }
    .header { text-align: center; border-bottom: 1px solid #f1f5f9; padding-bottom: 24px; margin-bottom: 24px; }
    .badge { display: inline-block; background-color: #fee2e2; color: #b91c1c; font-size: 13px; font-weight: 600; padding: 4px 12px; border-radius: 9999px; }
    .title { font-size: 22px; font-weight: 700; color: #0f172a; margin: 16px 0 8px 0; }
    .details { background-color: #fef2f2; border-radius: 8px; padding: 16px; margin: 20px 0; border: 1px solid #fecaca; }
    .row { display: flex; justify-content: space-between; padding: 8px 0; font-size: 14px; border-bottom: 1px solid #fee2e2; }
    .row:last-child { border-bottom: none; }
    .label { color: #7f1d1d; }
    .val { font-weight: 600; color: #991b1b; }
    .btn { display: inline-block; background-color: #0f172a; color: #ffffff !important; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: 600; margin-top: 16px; }
    .footer { text-align: center; font-size: 12px; color: #94a3b8; margin-top: 32px; }
  </style>
</head>
<body>
  <div class="card">
    <div class="header">
      <div class="badge">Payment Unsuccessful</div>
      <div class="title">Unable to process your payment</div>
      <p style="margin: 0; color: #64748b; font-size: 14px;">Hi <strong>${customerName}</strong>, we were unable to complete the payment for your order.</p>
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
        <span class="label">Reason:</span>
        <span class="val">${event.failureReason}</span>
      </div>
    </div>

    <p style="font-size: 14px; line-height: 1.6; color: #475569;">
      Don't worry, your order items are temporarily saved. No money was deducted from your account. You can retry paying with another payment method or credit/debit card using the link below:
    </p>

    <div style="text-align: center; margin: 24px 0;">
      <a href="${retryUrl}" class="btn">Retry Payment</a>
    </div>

    <div class="footer">
      OPEN-MART E-Commerce &bull; Need help? Reply to this email or contact support.
    </div>
  </div>
</body>
</html>
`;

    const text = `Hi ${customerName}, your payment for order #${event.orderId.slice(0, 8)} failed. Provider: ${event.provider.toUpperCase()}. Reason: ${event.failureReason}. You can retry paying at: ${retryUrl}`;

    try {
      this.logger.log(`Sending payment failure email to: ${recipientEmail}`);
      await this.notificationService.sendEmail({
        to: recipientEmail,
        subject,
        html,
        text,
      });
    } catch (err: any) {
      this.logger.error(
        `Failed to send payment failure alert email to ${recipientEmail}: ${err.message}`,
        err.stack,
      );
    }
  }
}
