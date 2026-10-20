import { Inject, Logger } from '@nestjs/common';
import { EventsHandler, IEventHandler } from '@nestjs/cqrs';
import { OrderShippedEvent } from '../../../order/domain/events/order-shipped.event.js';
import {
  NOTIFICATION_PORT,
  type NotificationPort,
} from '../ports/notification.port.js';
import { ConfigService } from '@nestjs/config';

@EventsHandler(OrderShippedEvent)
export class OrderShippedEventHandler implements IEventHandler<OrderShippedEvent> {
  private readonly logger = new Logger(OrderShippedEventHandler.name);

  constructor(
    @Inject(NOTIFICATION_PORT)
    private readonly notificationService: NotificationPort,
    private readonly configService: ConfigService,
  ) {}

  async handle(event: OrderShippedEvent): Promise<void> {
    this.logger.log(`Handling OrderShippedEvent for order: ${event.orderId}`);

    const adminEmail =
      this.configService.get<string>('SMTP_USER') ?? 'admin@openmart.com';

    const html = `
<!DOCTYPE html>
<html>
<body style="font-family: sans-serif; line-height: 1.6; color: #333;">
  <div style="max-width: 600px; margin: 20px auto; padding: 20px; border: 1px solid #eee; border-radius: 8px;">
    <h2 style="color: #111;">Your Order has been Shipped! 📦</h2>
    <p>Order ID: <strong>${event.orderId}</strong></p>
    <p>Tracking Number: <strong>${event.trackingNumber}</strong></p>
    ${event.courierName ? `<p>Courier: <strong>${event.courierName}</strong></p>` : ''}
    <p>Your package is on its way. You can track your shipment using the tracking number above.</p>
    <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;" />
    <p style="font-size: 12px; color: #888;">OPEN-MART Automated Notification</p>
  </div>
</body>
</html>
    `;

    try {
      await this.notificationService.sendEmail({
        to: adminEmail,
        subject: `Order Shipped: #${event.orderId.slice(0, 8)} (Tracking: ${event.trackingNumber})`,
        html,
      });
    } catch (err: any) {
      this.logger.error(
        `Failed to send order shipped notification email: ${err.message}`,
      );
    }
  }
}
