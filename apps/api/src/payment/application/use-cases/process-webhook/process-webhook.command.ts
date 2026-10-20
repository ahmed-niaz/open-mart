import { GenericWebhookRequest } from '../../ports/payment-gateway-strategy.port.js';

export class ProcessWebhookCommand {
  constructor(public readonly request: GenericWebhookRequest) {}
}
