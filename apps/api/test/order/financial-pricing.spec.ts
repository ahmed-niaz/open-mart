import { describe, expect, it } from 'vitest';
import { Money } from '../../src/shared/domain/value-objects/money.vo.js';
import { ShippingAddress } from '../../src/order/domain/value-objects/shipping-address.vo.js';
import { ShippingFeeCalculator } from '../../src/order/domain/services/shipping-fee-calculator.service.js';
import { VatCalculator } from '../../src/order/domain/services/vat-calculator.service.js';
import { PriceSnapshot } from '../../src/order/domain/value-objects/price-snapshot.vo.js';
import { OrderItem } from '../../src/order/domain/entities/order-item.entity.js';
import { Order } from '../../src/order/domain/entities/order.entity.js';

describe('Phase 2 Financial Accuracy: Bangladesh VAT & Tiered Shipping', () => {
  const dhakaAddress = ShippingAddress.create({
    recipientName: 'Sadman Sakib',
    recipientPhone: '01711223344',
    division: 'Dhaka',
    district: 'Dhaka',
    city: 'Dhaka North',
    area: 'Gulshan 2',
    addressLine: 'Road 11, House 25, Flat 4B',
    postalCode: '1212',
    country: 'BD',
  });

  const outsideDhakaAddress = ShippingAddress.create({
    recipientName: 'Tanvir Hossain',
    recipientPhone: '01811223344',
    division: 'Chattogram',
    district: 'Chattogram',
    city: 'Chattogram Metro',
    area: 'Agrabad',
    addressLine: 'CDA Residential Area, Road 3',
    postalCode: '4100',
    country: 'BD',
  });

  describe('ShippingFeeCalculator', () => {
    it('should calculate ৳60 (6000 cents) for delivery inside Dhaka', () => {
      const fee = ShippingFeeCalculator.calculate({
        address: dhakaAddress,
        subtotalAmount: Money.fromCents(50000, 'BDT'), // ৳500
      });

      expect(fee.toCents()).toBe(6000);
      expect(fee.getCurrency()).toBe('BDT');
    });

    it('should calculate ৳120 (12000 cents) for delivery outside Dhaka', () => {
      const fee = ShippingFeeCalculator.calculate({
        address: outsideDhakaAddress,
        subtotalAmount: Money.fromCents(50000, 'BDT'), // ৳500
      });

      expect(fee.toCents()).toBe(12000);
      expect(fee.getCurrency()).toBe('BDT');
    });

    it('should grant free shipping if subtotal is at or above free shipping threshold (৳2000)', () => {
      const fee = ShippingFeeCalculator.calculate({
        address: outsideDhakaAddress,
        subtotalAmount: Money.fromCents(200000, 'BDT'), // ৳2000
      });

      expect(fee.toCents()).toBe(0);
      expect(fee.getAmount()).toBe(0);
    });
  });

  describe('VatCalculator', () => {
    it('should correctly back out 15% VAT from VAT-inclusive retail price', () => {
      // If consumer price is ৳1150 (115,000 cents), backed out 15% VAT is exactly ৳150 (15,000 cents)
      const vat = VatCalculator.calculateBackedOutVat(
        Money.fromCents(115000, 'BDT'),
      );

      expect(vat.toCents()).toBe(15000);
    });

    it('should handle zero or negative taxable amounts safely', () => {
      const vatZero = VatCalculator.calculateBackedOutVat(Money.zero('BDT'));
      expect(vatZero.toCents()).toBe(0);
    });
  });

  describe('PriceSnapshot Value Object', () => {
    it('should encapsulate immutable order financials and net shipping calculations', () => {
      const snapshot = PriceSnapshot.create({
        subtotal: Money.fromCents(100000, 'BDT'), // ৳1000
        discountAmount: Money.fromCents(10000, 'BDT'), // ৳100
        shippingFee: Money.fromCents(6000, 'BDT'), // ৳60
        shippingFeeDiscount: Money.fromCents(2000, 'BDT'), // ৳20
        taxAmount: Money.fromCents(11739, 'BDT'), // ৳117.39
        total: Money.fromCents(94000, 'BDT'), // ৳940
      });

      expect(snapshot.subtotal.toCents()).toBe(100000);
      expect(snapshot.discountAmount.toCents()).toBe(10000);
      expect(snapshot.netShippingFee.toCents()).toBe(4000); // ৳60 - ৳20 = ৳40
      expect(snapshot.taxAmount.toCents()).toBe(11739);
      expect(snapshot.total.toCents()).toBe(94000);
    });
  });

  describe('Order Aggregate Financial Integration', () => {
    it('should automatically compute tiered shipping and backed-out VAT upon order placement', () => {
      const item = OrderItem.create({
        productId: 'prod-1',
        productName: 'Handloom Cotton Panjabi',
        productSku: 'PANJABI-001',
        unitPrice: Money.fromCents(115000, 'BDT'), // ৳1150
        quantity: 1,
      });

      const order = Order.place(
        'cust-1',
        [item],
        dhakaAddress,
        'Leave with guard',
      );

      // Subtotal should be ৳1150
      expect(order.getSubtotalAmount().toCents()).toBe(115000);

      // Shipping inside Dhaka should be ৳60
      expect(order.getShippingFeeAmount().toCents()).toBe(6000);
      expect(order.getShippingFeeDiscountAmount().toCents()).toBe(0);
      expect(order.getNetShippingAmount().toCents()).toBe(6000);

      // Total payable = ৳1150 + ৳60 = ৳1210
      expect(order.getTotalAmount().toCents()).toBe(121000);

      // Backed-out VAT (15% on ৳1150) = ৳150 (15,000 cents)
      expect(order.getTaxAmount().toCents()).toBe(15000);

      // Price snapshot export
      const snapshot = order.getPriceSnapshot();
      expect(snapshot.total.toCents()).toBe(121000);
      expect(snapshot.toObject().shippingFeeAmount).toBe(6000);
    });

    it('should apply discount and compute outside Dhaka delivery fee', () => {
      const item = OrderItem.create({
        productId: 'prod-2',
        productName: 'Jamdani Saree',
        productSku: 'SAREE-001',
        unitPrice: Money.fromCents(300000, 'BDT'), // ৳3000
        quantity: 1,
      });

      // Free shipping applies because ৳3000 >= ৳2000 threshold
      const order = Order.place('cust-2', [item], outsideDhakaAddress, null, {
        code: 'EID500',
        type: 'fixed_amount',
        amount: Money.fromCents(50000, 'BDT'), // ৳500 off
      });

      expect(order.getSubtotalAmount().toCents()).toBe(300000);
      expect(order.discountAmount.toCents()).toBe(50000);
      // Free shipping threshold met
      expect(order.getShippingFeeAmount().toCents()).toBe(0);
      // Total payable = ৳3000 - ৳500 + ৳0 = ৳2500
      expect(order.getTotalAmount().toCents()).toBe(250000);
    });
  });
});
