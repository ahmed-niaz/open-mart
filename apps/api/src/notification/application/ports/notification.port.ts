export const NOTIFICATION_PORT = Symbol('NOTIFICATION_PORT');

export interface SendEmailInput {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

export interface NotificationPort {
  sendEmail(input: SendEmailInput): Promise<void>;
}
