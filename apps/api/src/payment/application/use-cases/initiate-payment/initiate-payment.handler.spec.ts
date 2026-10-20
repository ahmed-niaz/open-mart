import { beforeEach, describe, expect, it, vi } from 'vitest';
import { InitiatePaymentCommandHandler } from './initiate-payment.handler.js';
import { InitiatePaymentCommand } from './initiate-payment.command.js';
import { OrderPaymentPort } from '../../ports/order-payment.port.js';
import { PaymentRepositoryPort } from '../../ports/payment.repository.js';
import { PaymentStrategyRegistry } from '../../../infrastructure/strategies/payment-strategy.registry.js';
import { PaymentGatewayStrategy } from '../../ports/payment-gateway-strategy.port.js';
import { Money } from '../../../../shared/domain/value-objects/money.vo.js';
import { ApplicationException } from '../../../../shared/domain/exceptions/application.exception.js';
import { Payment } from '../../../domain/entities/payment.entity.js';
import { PaymentProvider } from '../../../domain/value-objects/payment-provider.vo.js';

describe('InitiatePaymentCommandHandler', () => {
  let handler: InitiatePaymentCommandHandler;
  let mockOrderPort: OrderPaymentPort;
  let mockPaymentRepo: PaymentRepositoryPort;
  let mockStrategyRegistry: PaymentStrategyRegistry;
  let mockStrategy: PaymentGatewayStrategy;

  const orderId = crypto.randomUUID();

  beforeEach(() => {
    mockOrderPort = {
      getOrderForPayment: vi.fn(),
    };

    mockPaymentRepo = {
      save: vi.fn().mockResolvedValue(undefined),
      findById: vi.fn(),
      findByOrderId: vi.fn().mockResolvedValue(null),
      findByTransactionId: vi.fn(),
      processWebhookEventAtomic: vi.fn(),
    };

    mockStrategy = {
      getProviderName: vi.fn().mockReturnValue('stripe'),
      initiatePayment: vi.fn().mockResolvedValue({
        transactionId: 'cs_test_session_123',
        checkoutUrl: 'https://checkout.stripe.com/pay/cs_test_session_123',
        provider: 'stripe',
      }),
      verifyAndParseWebhook: vi.fn(),
    };

    mockStrategyRegistry = {
      getStrategy: vi.fn().mockReturnValue(mockStrategy),
    } as unknown as PaymentStrategyRegistry;

    handler = new InitiatePaymentCommandHandler(
      mockOrderPort,
      mockPaymentRepo,
      mockStrategyRegistry,
    );
  });

  it('should throw NOT_FOUND if order does not exist', async () => {
    vi.mocked(mockOrderPort.getOrderForPayment).mockResolvedValue(null);

    await expect(
      handler.execute(new InitiatePaymentCommand(orderId, 'stripe')),
    ).rejects.toThrow(ApplicationException);
  });

  it('should throw VALIDATION_ERROR if order is not pending', async () => {
    vi.mocked(mockOrderPort.getOrderForPayment).mockResolvedValue({
      orderId,
      customerId: 'cust-1',
      status: 'confirmed',
      totalAmount: Money.fromCents(5000, 'USD'),
      customerEmail: 'cust@example.com',
      customerName: 'Customer Test',
      customerPhone: '01700000000',
      shippingAddress: {
        recipientName: 'Recipient',
        recipientPhone: '01700000000',
        addressLine: '123 Test St',
        city: 'City',
        district: 'District',
        division: 'Division',
        postalCode: '1200',
      },
    });

    await expect(
      handler.execute(new InitiatePaymentCommand(orderId, 'stripe')),
    ).rejects.toThrow(ApplicationException);
  });

  it('should throw CONFLICT if order has already been paid', async () => {
    vi.mocked(mockOrderPort.getOrderForPayment).mockResolvedValue({
      orderId,
      customerId: 'cust-1',
      status: 'pending',
      totalAmount: Money.fromCents(5000, 'USD'),
      customerEmail: 'cust@example.com',
      customerName: 'Customer Test',
      customerPhone: '01700000000',
      shippingAddress: {
        recipientName: 'Recipient',
        recipientPhone: '01700000000',
        addressLine: '123 Test St',
        city: 'City',
        district: 'District',
        division: 'Division',
        postalCode: '1200',
      },
    });

    const paidPayment = Payment.create({
      orderId,
      provider: PaymentProvider.stripe(),
      amount: Money.fromCents(5000, 'USD'),
    });
    paidPayment.complete('ch_already_paid');
    vi.mocked(mockPaymentRepo.findByOrderId).mockResolvedValue(paidPayment);

    await expect(
      handler.execute(new InitiatePaymentCommand(orderId, 'stripe')),
    ).rejects.toThrow(ApplicationException);
  });

  it('should initiate payment and return checkoutUrl successfully', async () => {
    vi.mocked(mockOrderPort.getOrderForPayment).mockResolvedValue({
      orderId,
      customerId: 'cust-1',
      status: 'pending',
      totalAmount: Money.fromCents(5000, 'USD'),
      customerEmail: 'cust@example.com',
      customerName: 'Customer Test',
      customerPhone: '01700000000',
      shippingAddress: {
        recipientName: 'Recipient',
        recipientPhone: '01700000000',
        addressLine: '123 Test St',
        city: 'City',
        district: 'District',
        division: 'Division',
        postalCode: '1200',
      },
    });

    const result = await handler.execute(
      new InitiatePaymentCommand(orderId, 'stripe', 'idemp-key-123'),
    );

    expect(result.orderId).toBe(orderId);
    expect(result.provider).toBe('stripe');
    expect(result.amount).toBe(5000);
    expect(result.currency).toBe('USD');
    expect(result.transactionId).toBe('cs_test_session_123');
    expect(result.checkoutUrl).toBe(
      'https://checkout.stripe.com/pay/cs_test_session_123',
    );
    expect(mockPaymentRepo.save).toHaveBeenCalled();
  });
});
