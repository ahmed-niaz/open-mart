import { Inject, Logger } from '@nestjs/common';
import { EventsHandler, IEventHandler } from '@nestjs/cqrs';
import { OrderPlacedEvent } from '../../../order/domain/events/order-placed.event.js';
import {
  NOTIFICATION_PORT,
  type NotificationPort,
} from '../ports/notification.port.js';
import { ConfigService } from '@nestjs/config';

@EventsHandler(OrderPlacedEvent)
export class OrderPlacedEventHandler implements IEventHandler<OrderPlacedEvent> {
  private readonly logger = new Logger(OrderPlacedEventHandler.name);

  constructor(
    @Inject(NOTIFICATION_PORT)
    private readonly notificationService: NotificationPort,
    private readonly configService: ConfigService,
  ) {}

  async handle(event: OrderPlacedEvent): Promise<void> {
    this.logger.log(`Handling OrderPlacedEvent for order: ${event.orderId}`);

    const adminEmail =
      this.configService.get<string>('SMTP_USER') ?? 'admin@openmart.com';
    const totalFormatted = (event.totalAmount / 100).toFixed(2);

    const itemsListHtml = event.items
      .map(
        (i) =>
          `<li><strong>${i.productName}</strong> (SKU: ${i.productSku}) &times; ${i.quantity} &mdash; $${(i.unitPriceAmount / 100).toFixed(2)}</li>`,
      )
      .join('');

    const html = `
<!DOCTYPE html>
<html>
<body style="font-family: sans-serif; line-height: 1.6; color: #333;">
  <div style="max-width: 600px; margin: 20px auto; padding: 20px; border: 1px solid #eee; border-radius: 8px;">
    <h2 style="color: #111;">Order Placed Successfully! 🛒</h2>
    <p>Order ID: <strong>${event.orderId}</strong></p>
    <p>Total: <strong>$${totalFormatted} ${event.currency}</strong></p>
    <h3>Items:</h3>
    <ul>${itemsListHtml}</ul>
    <p>Recipient: <strong>${event.shippingAddress.recipientName} (${event.shippingAddress.recipientPhone})</strong></p>
    <p>Delivery Address: <strong>${event.shippingAddress.addressLine}, ${event.shippingAddress.area}, ${event.shippingAddress.city}, ${event.shippingAddress.district}, ${event.shippingAddress.division}</strong></p>
    <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;" />
    <p style="font-size: 12px; color: #888;">OPEN-MART Automated Notification</p>
  </div>
</body>
</html>
    `;

    try {
      await this.notificationService.sendEmail({
        to: adminEmail,
        subject: `New Order Placed: #${event.orderId.slice(0, 8)} ($${totalFormatted})`,
        html,
      });
    } catch (err: any) {
      this.logger.error(
        `Failed to send order notification email: ${err.message}`,
      );
    }
  }
}
