import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';

import {
  NotificationPort,
  SendEmailInput,
} from '../../application/ports/notification.port.js';

@Injectable()
export class NodemailerNotificationAdapter implements NotificationPort {
  private readonly transporter: Transporter;
  private readonly from: string;
  private readonly logger = new Logger(NodemailerNotificationAdapter.name);

  constructor(private readonly configService: ConfigService) {
    const host = this.configService.get<string>('SMTP_HOST', 'smtp.gmail.com');
    const port = Number(this.configService.get<number>('SMTP_PORT', 465));
    const secure =
      this.configService.get<string>('SMTP_SECURE', 'true') === 'true' ||
      port === 465;
    const user = this.configService.get<string>('SMTP_USER', '');
    const pass = this.configService.get<string>('SMTP_PASS', '');

    this.from = this.configService.get<string>(
      'SMTP_FROM',
      `OPEN-MART <${user}>`,
    );

    this.transporter = nodemailer.createTransport({
      host,
      port,
      secure,
      auth: {
        user,
        pass,
      },
    });
  }

  async sendEmail(input: SendEmailInput): Promise<void> {
    try {
      const info = await this.transporter.sendMail({
        from: this.from,
        to: input.to,
        subject: input.subject,
        text: input.text ?? input.subject,
        html: input.html,
      });

      this.logger.log(
        `Email sent successfully to: ${input.to} (Message ID: ${info.messageId})`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to send email to ${input.to}: ${(error as Error).message}`,
        (error as Error).stack,
      );
      // We log error rather than throwing to prevent unhandled background event crashes
    }
  }
}
