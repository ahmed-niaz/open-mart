import { Injectable, Logger } from '@nestjs/common';
import {
  NotificationPort,
  SendEmailInput,
} from '../../application/ports/notification.port.js';

@Injectable()
export class ConsoleNotificationAdapter implements NotificationPort {
  private readonly logger = new Logger(ConsoleNotificationAdapter.name);

  async sendEmail(input: SendEmailInput): Promise<void> {
    this.logger.log(
      `[DEV EMAIL NOTIFICATION]\nTo: ${input.to}\nSubject: ${input.subject}\nBody:\n${input.text ?? input.html}`,
    );
  }
}
