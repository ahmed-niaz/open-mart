import { Injectable } from '@nestjs/common';

import { PaymentGatewayStrategy } from '../../application/ports/payment-gateway-strategy.port.js';
import { StripePaymentStrategy } from './stripe.strategy.js';
import { CodPaymentStrategy } from './cod.strategy.js';
import { SslCommerzPaymentStrategy } from './sslcommerz.strategy.js';
import {
  ApplicationException,
  ApplicationExceptionCode,
} from '../../../shared/domain/exceptions/application.exception.js';
import { PaymentProvider } from '../../domain/value-objects/payment-provider.vo.js';

@Injectable()
export class PaymentStrategyRegistry {
  private readonly strategies: Map<string, PaymentGatewayStrategy> = new Map();

  constructor(
    stripeStrategy: StripePaymentStrategy,
    codStrategy: CodPaymentStrategy,
    sslcommerzStrategy: SslCommerzPaymentStrategy,
  ) {
    this.register(stripeStrategy);
    this.register(codStrategy);
    this.register(sslcommerzStrategy);
  }

  private register(strategy: PaymentGatewayStrategy): void {
    this.strategies.set(strategy.getProviderName(), strategy);
  }

  getStrategy(provider: PaymentProvider | string): PaymentGatewayStrategy {
    const key =
      typeof provider === 'string'
        ? provider.toLowerCase().trim()
        : provider.getValue();

    const strategy = this.strategies.get(key);
    if (!strategy) {
      throw new ApplicationException(
        `Payment provider '${key}' is not supported or configured`,
        ApplicationExceptionCode.NOT_FOUND,
      );
    }
    return strategy;
  }
}
