import { describe, expect, it, vi, beforeEach } from 'vitest';
import { ConfigService } from '@nestjs/config';

import { PaymentCompletedNotificationHandler } from '../../src/notification/application/event-handlers/payment-completed.event-handler.js';
import { PaymentFailedNotificationHandler } from '../../src/notification/application/event-handlers/payment-failed.event-handler.js';
import { PaymentCancelledNotificationHandler } from '../../src/notification/application/event-handlers/payment-cancelled.event-handler.js';
import { PaymentCompletedIntegrationEvent } from '../../src/shared/contracts/events/payment-completed.event.js';
import { PaymentFailedIntegrationEvent } from '../../src/shared/contracts/events/payment-failed.event.js';
import { PaymentCancelledIntegrationEvent } from '../../src/shared/contracts/events/payment-cancelled.event.js';

describe('Payment Notification Event Handlers', () => {
  let mockNotificationService: any;
  let mockDb: any;
  let mockConfigService: any;

  beforeEach(() => {
    mockNotificationService = {
      sendEmail: vi.fn().mockResolvedValue(undefined),
    };

    mockConfigService = {
      get: vi.fn((key: string, defaultValue?: any) => {
        if (key === 'SMTP_USER') return 'store@openmart.com';
        if (key === 'FRONTEND_URL') return 'http://localhost:3000';
        return defaultValue;
      }),
    };

    // Mock Drizzle chained select queries
    const mockOrderResult = [
      {
        order: {
          id: 'ord-123',
          recipientName: 'Alice Customer',
          recipientPhone: '01700000000',
          shippingAddressLine: '123 Main St',
          shippingArea: 'Gulshan',
          shippingCity: 'Dhaka',
          shippingDistrict: 'Dhaka',
          totalAmount: 4500,
        },
        customerEmail: 'alice@customer.com',
        customerFirstName: 'Alice',
        customerLastName: 'Smith',
      },
    ];

    const mockItemsResult = [
      {
        id: 'item-1',
        orderId: 'ord-123',
        productName: 'Ceramic Coffee Mug',
        productSku: 'MUG-001',
        unitPriceAmount: 4500,
        quantity: 1,
      },
    ];

    mockDb = {
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          leftJoin: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue(mockOrderResult),
            }),
          }),
          where: vi.fn().mockResolvedValue(mockItemsResult),
        }),
      }),
    };
  });

  describe('PaymentCompletedNotificationHandler', () => {
    it('should send a payment confirmation receipt email to the customer email', async () => {
      const handler = new PaymentCompletedNotificationHandler(
        mockNotificationService,
        mockDb,
        mockConfigService as unknown as ConfigService,
      );

      const event = new PaymentCompletedIntegrationEvent(
        'pay-123',
        'ord-123',
        'cust-123',
        'sslcommerz',
        'SSL-TXN-999',
        4500,
        'USD',
        'alice@customer.com',
        'Alice Smith',
      );

      await handler.handle(event);

      expect(mockNotificationService.sendEmail).toHaveBeenCalledTimes(1);
      const callArgs = mockNotificationService.sendEmail.mock.calls[0][0];
      expect(callArgs.to).toBe('alice@customer.com');
      expect(callArgs.subject).toContain('Payment Confirmed');
      expect(callArgs.html).toContain('SSL-TXN-999');
      expect(callArgs.html).toContain('Alice Smith');
      expect(callArgs.html).toContain('$45.00 USD');
    });
  });

  describe('PaymentFailedNotificationHandler', () => {
    it('should send a payment failure alert email with retry link to customer', async () => {
      const handler = new PaymentFailedNotificationHandler(
        mockNotificationService,
        mockDb,
        mockConfigService as unknown as ConfigService,
      );

      const event = new PaymentFailedIntegrationEvent(
        'pay-123',
        'ord-123',
        'cust-123',
        'stripe',
        'Card declined by issuer',
        'card_declined',
        'alice@customer.com',
        'Alice Smith',
      );

      await handler.handle(event);

      expect(mockNotificationService.sendEmail).toHaveBeenCalledTimes(1);
      const callArgs = mockNotificationService.sendEmail.mock.calls[0][0];
      expect(callArgs.to).toBe('alice@customer.com');
      expect(callArgs.subject).toContain('Payment Unsuccessful');
      expect(callArgs.html).toContain('Card declined by issuer');
      expect(callArgs.html).toContain(
        'http://localhost:3000/checkout?order_id=ord-123',
      );
    });
  });

  describe('PaymentCancelledNotificationHandler', () => {
    it('should send a payment cancellation email with resume checkout link to customer', async () => {
      const handler = new PaymentCancelledNotificationHandler(
        mockNotificationService,
        mockDb,
        mockConfigService as unknown as ConfigService,
      );

      const event = new PaymentCancelledIntegrationEvent(
        'pay-123',
        'ord-123',
        'cust-123',
        'sslcommerz',
        'Customer cancelled the payment on SSLCommerz',
        'alice@customer.com',
        'Alice Smith',
      );

      await handler.handle(event);

      expect(mockNotificationService.sendEmail).toHaveBeenCalledTimes(1);
      const callArgs = mockNotificationService.sendEmail.mock.calls[0][0];
      expect(callArgs.to).toBe('alice@customer.com');
      expect(callArgs.subject).toContain('Payment Cancelled');
      expect(callArgs.html).toContain(
        'Customer cancelled the payment on SSLCommerz',
      );
      expect(callArgs.html).toContain(
        'http://localhost:3000/checkout?order_id=ord-123',
      );
    });
  });
});
