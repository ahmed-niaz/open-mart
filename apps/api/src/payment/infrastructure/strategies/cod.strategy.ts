import { Injectable, Logger } from '@nestjs/common';

import {
  GatewayRefundResult,
  GenericWebhookRequest,
  InitiatePaymentInput,
  InitiatePaymentResult,
  PaymentGatewayStrategy,
  WebhookVerificationResult,
} from '../../application/ports/payment-gateway-strategy.port.js';
import { Money } from '../../../shared/domain/value-objects/money.vo.js';
import {
  ApplicationException,
  ApplicationExceptionCode,
} from '../../../shared/domain/exceptions/application.exception.js';

@Injectable()
export class CodPaymentStrategy implements PaymentGatewayStrategy {
  private readonly logger = new Logger(CodPaymentStrategy.name);

  getProviderName(): 'cod' {
    return 'cod';
  }

  async initiatePayment(
    input: InitiatePaymentInput,
  ): Promise<InitiatePaymentResult> {
    const codTransactionId = `COD-${input.orderId.slice(0, 8)}-${Date.now()}`;
    this.logger.log(
      `Initiating Cash on Delivery payment for order: ${input.orderId} (Txn: ${codTransactionId})`,
    );

    return {
      transactionId: codTransactionId,
      provider: 'cod',
      metadata: {
        type: 'CASH_ON_DELIVERY',
        instructions: 'Pay cash directly upon receiving physical delivery',
      },
    };
  }

  async verifyAndParseWebhook(
    _request: GenericWebhookRequest,
  ): Promise<WebhookVerificationResult> {
    throw new ApplicationException(
      'Cash on Delivery does not accept external webhooks',
      ApplicationExceptionCode.VALIDATION_ERROR,
    );
  }

  async refund(
    _transactionId: string,
    _amount: Money,
    _reason?: string,
  ): Promise<GatewayRefundResult> {
    return {
      refundId: `COD-REFUND-${Date.now()}`,
      status: 'completed',
      isOfflinePayout: true,
    };
  }
}
