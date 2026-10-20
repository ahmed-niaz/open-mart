import { describe, expect, it } from 'vitest';

import { Sku } from '../../src/inventory/domain/value-objects/sku.vo.js';
import { Quantity } from '../../src/inventory/domain/value-objects/quantity.vo.js';
import { StockLevel } from '../../src/inventory/domain/value-objects/stock-level.vo.js';
import { Reservation } from '../../src/inventory/domain/entities/reservation.entity.js';
import { InventoryItem } from '../../src/inventory/domain/entities/inventory-item.entity.js';
import { DomainException } from '../../src/shared/domain/exceptions/domain.exception.js';
import { ReservationConflictException } from '../../src/inventory/domain/exceptions/reservation-conflict.exception.js';

describe('Inventory Domain Value Objects & Entities', () => {
  describe('Sku Value Object', () => {
    it('should normalize and uppercase valid SKU', () => {
      const sku = Sku.create('  mug-wht-001  ');
      expect(sku.getValue()).toBe('MUG-WHT-001');
    });

    it('should reject invalid or too short SKU', () => {
      expect(() => Sku.create('AB')).toThrow(DomainException);
      expect(() => Sku.create('invalid SKU with spaces!')).toThrow(
        DomainException,
      );
    });
  });

  describe('Quantity Value Object', () => {
    it('should reject negative quantities', () => {
      expect(() => Quantity.create(-5)).toThrow(DomainException);
    });

    it('should add and subtract correctly', () => {
      const q1 = Quantity.create(10);
      const q2 = Quantity.create(3);
      expect(q1.add(q2).getValue()).toBe(13);
      expect(q1.subtract(q2).getValue()).toBe(7);
    });

    it('should throw when subtracting below zero', () => {
      const q1 = Quantity.create(3);
      expect(() => q1.subtract(5)).toThrow(DomainException);
    });
  });

  describe('StockLevel Value Object', () => {
    it('should compute available quantity accurately', () => {
      const stock = StockLevel.create(20, 5);
      expect(stock.getOnHand().getValue()).toBe(20);
      expect(stock.getReserved().getValue()).toBe(5);
      expect(stock.getAvailable().getValue()).toBe(15);
      expect(stock.canFulfill(15)).toBe(true);
      expect(stock.canFulfill(16)).toBe(false);
    });

    it('should throw if reserved exceeds on-hand', () => {
      expect(() => StockLevel.create(5, 10)).toThrow(DomainException);
    });

    it('should detect low stock and out of stock conditions', () => {
      const lowStock = StockLevel.create(10, 7); // available = 3
      expect(lowStock.isLowStock(5)).toBe(true);
      expect(lowStock.isOutOfStock()).toBe(false);

      const outOfStock = StockLevel.create(10, 10); // available = 0
      expect(outOfStock.isOutOfStock()).toBe(true);
    });
  });

  describe('Reservation Entity', () => {
    it('should transition from reserved to committed', () => {
      const res = Reservation.create({
        orderId: 'ord-1',
        inventoryItemId: 'item-1',
        sku: 'MUG-WHT-001',
        quantity: 2,
        ttlMinutes: 30,
      });

      expect(res.status).toBe('reserved');
      res.commit(18);
      expect(res.status).toBe('committed');
    });

    it('should throw conflict when committing an already committed or released reservation', () => {
      const res = Reservation.create({
        orderId: 'ord-1',
        inventoryItemId: 'item-1',
        sku: 'MUG-WHT-001',
        quantity: 2,
      });

      res.commit(18);
      expect(() => res.commit(18)).toThrow(ReservationConflictException);
      expect(() => res.release()).toThrow(ReservationConflictException);
    });

    it('should allow reversing a committed reservation on post-confirmation order cancellation', () => {
      const res = Reservation.create({
        orderId: 'ord-1',
        inventoryItemId: 'item-1',
        sku: 'MUG-WHT-001',
        quantity: 2,
      });

      res.commit(18);
      res.reverse('Order cancelled by customer after payment');
      expect(res.status).toBe('reversed');
    });
  });

  describe('InventoryItem Entity', () => {
    it('should emit low stock detected event on threshold boundary crossing', () => {
      const item = InventoryItem.create({
        productId: 'prod-1',
        sku: 'SHIRT-BLK-M',
        initialOnHand: 20,
        lowStockThreshold: 5,
      });

      // Previous available was 10, now at 4 (crossed threshold of 5)
      item.stockLevel.withOnHand(Quantity.create(4));
      // Reconstitute with onHand=4 to test crossing
      const updatedItem = InventoryItem.reconstitute({
        id: item.id,
        productId: item.productId,
        sku: item.sku,
        stockLevel: StockLevel.create(4, 0),
        lowStockThreshold: 5,
        isActive: true,
        version: 1,
        createdAt: item.createdAt,
        updatedAt: item.updatedAt,
      });

      updatedItem.checkLowStockThresholdCrossing(10);
      const events = updatedItem.getUncommittedEvents();
      expect(events.length).toBe(1);
      expect(events[0].constructor.name).toBe('LowStockDetectedEvent');
    });
  });
});
