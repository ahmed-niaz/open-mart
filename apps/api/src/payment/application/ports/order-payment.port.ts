import { Money } from '../../../shared/domain/value-objects/money.vo.js';

export interface OrderPaymentSnapshot {
  orderId: string;
  customerId: string | null;
  status: string;
  totalAmount: Money;
  customerEmail: string | null;
  customerName: string | null;
  customerPhone: string | null;
  shippingAddress: {
    recipientName: string;
    recipientPhone: string;
    addressLine: string;
    city: string;
    district: string;
    division: string;
    postalCode: string | null;
  };
}

export const ORDER_PAYMENT_PORT = Symbol('ORDER_PAYMENT_PORT');

export interface OrderPaymentPort {
  getOrderForPayment(orderId: string): Promise<OrderPaymentSnapshot | null>;
}

