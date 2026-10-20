import { Inject, Injectable, Logger } from '@nestjs/common';
import { EventsHandler, IEventHandler } from '@nestjs/cqrs';
import { ConfigService } from '@nestjs/config';

import { LowStockDetectedEvent } from '../../domain/events/low-stock-detected.event.js';
import {
  NOTIFICATION_PORT,
  type NotificationPort,
} from '../../../notification/application/ports/notification.port.js';

@Injectable()
@EventsHandler(LowStockDetectedEvent)
export class LowStockDetectedInventoryHandler implements IEventHandler<LowStockDetectedEvent> {
  private readonly logger = new Logger(LowStockDetectedInventoryHandler.name);

  constructor(
    @Inject(NOTIFICATION_PORT)
    private readonly notificationService: NotificationPort,
    private readonly configService: ConfigService,
  ) {}

  async handle(event: LowStockDetectedEvent): Promise<void> {
    this.logger.warn(
      `LOW STOCK ALERT: SKU '${event.sku}' has crossed low stock threshold! Available: ${event.availableQuantity} (Threshold: ${event.threshold})`,
    );

    const adminEmail =
      this.configService.get<string>('ADMIN_NOTIFICATION_EMAIL') ||
      this.configService.get<string>('SMTP_USER') ||
      'admin@openmart.com';

    const subject = `⚠️ Low Stock Alert: SKU ${event.sku} (${event.availableQuantity} remaining)`;
    const text = `Attention: Inventory for SKU ${event.sku} is low. Only ${event.availableQuantity} units remain in stock (threshold: ${event.threshold}). Please review and restock soon.`;
    const html = `
      <div style="font-family: sans-serif; padding: 20px; border: 1px solid #fed7aa; border-radius: 8px; background: #fffaf0;">
        <h3 style="color: #c2410c; margin-top: 0;">⚠️ Low Stock Alert</h3>
        <p>The warehouse stock for <strong>${event.sku}</strong> has dropped below the minimum threshold.</p>
        <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
          <tr>
            <td style="padding: 6px; color: #78350f;"><strong>SKU:</strong></td>
            <td style="padding: 6px; font-weight: bold;">${event.sku}</td>
          </tr>
          <tr>
            <td style="padding: 6px; color: #78350f;"><strong>Available Quantity:</strong></td>
            <td style="padding: 6px; color: #c2410c; font-weight: bold;">${event.availableQuantity} units</td>
          </tr>
          <tr>
            <td style="padding: 6px; color: #78350f;"><strong>Threshold:</strong></td>
            <td style="padding: 6px;">${event.threshold} units</td>
          </tr>
        </table>
        <p style="font-size: 13px; color: #78716c;">Please log in to the Open-Mart dashboard and record a restock to maintain order fulfillment.</p>
      </div>
    `;

    try {
      await this.notificationService.sendEmail({
        to: adminEmail,
        subject,
        html,
        text,
      });
    } catch (err: any) {
      this.logger.error(
        `Failed to send low stock notification email: ${err.message}`,
      );
    }
  }
}
