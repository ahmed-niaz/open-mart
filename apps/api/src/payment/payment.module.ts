import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { ConfigModule } from '@nestjs/config';

import { AuthModule } from '../shared/infrastructure/auth/auth.module.js';
import { CustomerModule } from '../customer/customer.module.js';
import { PaymentController } from './presentation/payment.controller.js';
import { PAYMENT_REPOSITORY } from './application/ports/payment.repository.js';
import { DrizzlePaymentRepository } from './infrastructure/adapters/drizzle-payment.repository.js';
import { ORDER_PAYMENT_PORT } from './application/ports/order-payment.port.js';
import { OrderPaymentAdapter } from './infrastructure/adapters/order-payment.adapter.js';
import { StripePaymentStrategy } from './infrastructure/strategies/stripe.strategy.js';
import { CodPaymentStrategy } from './infrastructure/strategies/cod.strategy.js';
import { SslCommerzPaymentStrategy } from './infrastructure/strategies/sslcommerz.strategy.js';
import { PaymentStrategyRegistry } from './infrastructure/strategies/payment-strategy.registry.js';
import { InitiatePaymentCommandHandler } from './application/use-cases/initiate-payment/initiate-payment.handler.js';
import { ProcessWebhookCommandHandler } from './application/use-cases/process-webhook/process-webhook.handler.js';
import { HandleRedirectCallbackCommandHandler } from './application/use-cases/handle-redirect-callback/handle-redirect-callback.handler.js';
import { VerifyStripeSessionCommandHandler } from './application/use-cases/verify-stripe-session/verify-stripe-session.handler.js';
import { CancelPaymentCommandHandler } from './application/use-cases/cancel-payment/cancel-payment.handler.js';
import { GetPaymentByOrderIdQueryHandler } from './application/queries/get-payment-by-order-id/get-payment-by-order-id.handler.js';
import { OrderDeliveredPaymentHandler } from './application/event-handlers/order-delivered.event-handler.js';
import { OrderCancelledPaymentHandler } from './application/event-handlers/order-cancelled.event-handler.js';
import { OptionalJwtAuthGuard } from '../shared/infrastructure/guards/optional-jwt-auth.guard.js';

@Module({
  imports: [CqrsModule, ConfigModule, AuthModule, CustomerModule],
  controllers: [PaymentController],
  providers: [
    {
      provide: PAYMENT_REPOSITORY,
      useClass: DrizzlePaymentRepository,
    },
    {
      provide: ORDER_PAYMENT_PORT,
      useClass: OrderPaymentAdapter,
    },
    StripePaymentStrategy,
    CodPaymentStrategy,
    SslCommerzPaymentStrategy,
    PaymentStrategyRegistry,
    InitiatePaymentCommandHandler,
    ProcessWebhookCommandHandler,
    HandleRedirectCallbackCommandHandler,
    VerifyStripeSessionCommandHandler,
    CancelPaymentCommandHandler,
    GetPaymentByOrderIdQueryHandler,
    OrderDeliveredPaymentHandler,
    OrderCancelledPaymentHandler,
    OptionalJwtAuthGuard,
  ],
  exports: [PAYMENT_REPOSITORY],
})
export class PaymentModule {}

