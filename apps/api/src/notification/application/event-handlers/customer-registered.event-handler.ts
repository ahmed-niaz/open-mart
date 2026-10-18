import { Inject, Logger } from '@nestjs/common';
import { EventsHandler, IEventHandler } from '@nestjs/cqrs';

import { CustomerRegisteredEvent } from '../../../customer/domain/events/customer-registered.event.js';
import {
  NOTIFICATION_PORT,
  type NotificationPort,
} from '../ports/notification.port.js';

@EventsHandler(CustomerRegisteredEvent)
export class CustomerRegisteredEventHandler implements IEventHandler<CustomerRegisteredEvent> {
  private readonly logger = new Logger(CustomerRegisteredEventHandler.name);

  constructor(
    @Inject(NOTIFICATION_PORT)
    private readonly notificationService: NotificationPort,
  ) {}

  async handle(event: CustomerRegisteredEvent): Promise<void> {
    this.logger.log(
      `Handling CustomerRegisteredEvent for customer: ${event.customerId} (${event.email})`,
    );

    const subject = `Welcome to OPEN-MART, ${event.firstName}! 🎉`;

    const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Welcome to OPEN-MART</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f4f4f7; color: #333333; margin: 0; padding: 0; }
    .container { max-width: 600px; margin: 30px auto; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.05); }
    .header { background: linear-gradient(135deg, #18181b 0%, #27272a 100%); color: #ffffff; padding: 30px 40px; text-align: center; }
    .header h1 { margin: 0; font-size: 24px; font-weight: 700; letter-spacing: -0.5px; }
    .content { padding: 40px; line-height: 1.6; }
    .content h2 { margin-top: 0; font-size: 20px; color: #18181b; }
    .badge { display: inline-block; padding: 4px 12px; background-color: #f4f4f5; border-radius: 9999px; font-size: 13px; font-weight: 500; color: #71717a; margin-top: 5px; }
    .footer { background-color: #fafafa; padding: 20px 40px; text-align: center; font-size: 12px; color: #a1a1aa; border-top: 1px solid #f4f4f5; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>OPEN-MART</h1>
    </div>
    <div class="content">
      <h2>Hello ${event.firstName} ${event.lastName},</h2>
      <p>Thank you for creating an account with <strong>OPEN-MART</strong>! We are thrilled to welcome you to our store.</p>
      <p>You can now browse products, save your favorite items, track your orders, and enjoy a seamless shopping experience.</p>
      <div>
        <span class="badge">Registration Method: ${event.authProvider === 'google' ? 'Google Account' : 'Email & Password'}</span>
      </div>
      <p style="margin-top: 30px;">If you have any questions or need assistance, our support team is always here to help.</p>
      <p>Best regards,<br><strong>The OPEN-MART Team</strong></p>
    </div>
    <div class="footer">
      <p>&copy; ${new Date().getFullYear()} OPEN-MART. All rights reserved.</p>
    </div>
  </div>
</body>
</html>
    `;

    const text = `Hello ${event.firstName},\n\nWelcome to OPEN-MART! Your account has been registered successfully using ${event.authProvider}.\n\nBest regards,\nThe OPEN-MART Team`;

    await this.notificationService.sendEmail({
      to: event.email,
      subject,
      html,
      text,
    });
  }
}
