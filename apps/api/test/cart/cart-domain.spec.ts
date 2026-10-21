import { describe, expect, it } from 'vitest';
import { Cart } from '../../src/cart/domain/entities/cart.entity.js';
import { CartId } from '../../src/cart/domain/value-objects/cart-id.vo.js';
import { MAX_QUANTITY_PER_ITEM } from '../../src/cart/domain/entities/cart-item.entity.js';
import { DomainException } from '../../src/shared/domain/exceptions/domain.exception.js';
import { CartCreatedEvent } from '../../src/cart/domain/events/cart-created.event.js';
import { CartItemAddedEvent } from '../../src/cart/domain/events/cart-item-added.event.js';
import { CartItemRemovedEvent } from '../../src/cart/domain/events/cart-item-removed.event.js';
import { CartClearedEvent } from '../../src/cart/domain/events/cart-cleared.event.js';
import { CartMergedEvent } from '../../src/cart/domain/events/cart-merged.event.js';
import { CartConvertedEvent } from '../../src/cart/domain/events/cart-converted.event.js';
import { CartAbandonedEvent } from '../../src/cart/domain/events/cart-abandoned.event.js';

describe('Cart Aggregate Root (Domain Layer)', () => {
  const p1 = '00000000-0000-0000-0000-000000000001';
  const p2 = '00000000-0000-0000-0000-000000000002';
  const p3 = '00000000-0000-0000-0000-000000000003';

  describe('Creation & Invariants', () => {
    it('creates an active cart for an anonymous guest and emits CartCreatedEvent', () => {
      const cart = Cart.create({ guestId: 'guest-session-123' });

      expect(cart.id).toBeInstanceOf(CartId);
      expect(cart.guestId).toBe('guest-session-123');
      expect(cart.customerId).toBeNull();
      expect(cart.status.isActive()).toBe(true);
      expect(cart.currency).toBe('BDT');
      expect(cart.items).toHaveLength(0);
      expect(cart.version).toBe(1);

      const events = cart.getUncommittedEvents();
      expect(events).toHaveLength(1);
      expect(events[0]).toBeInstanceOf(CartCreatedEvent);
      expect((events[0] as CartCreatedEvent).guestId).toBe('guest-session-123');
    });

    it('creates an active cart for a registered customer', () => {
      const cart = Cart.create({ customerId: 'cust-uuid-456' });

      expect(cart.customerId).toBe('cust-uuid-456');
      expect(cart.guestId).toBeNull();
      expect(cart.status.isActive()).toBe(true);
    });

    it('throws DomainException if neither customerId nor guestId is provided', () => {
      expect(() => Cart.create({})).toThrow(DomainException);
      expect(() => Cart.create({ customerId: '', guestId: '   ' })).toThrow(
        DomainException,
      );
    });
  });

  describe('Adding and Modifying Items', () => {
    it('adds items, accumulates quantities for same product, and emits CartItemAddedEvent', () => {
      const cart = Cart.create({ guestId: 'guest-1' });
      cart.clearEvents();

      const item1 = cart.addItem(p1, 2);
      expect(item1.productId).toBe(p1);
      expect(item1.quantity).toBe(2);
      expect(cart.totalQuantity).toBe(2);
      expect(cart.distinctItemCount).toBe(1);

      // Add 3 more of the same product
      const item2 = cart.addItem(p1, 3);
      expect(item2.quantity).toBe(5);
      expect(cart.totalQuantity).toBe(5);
      expect(cart.distinctItemCount).toBe(1);

      // Add distinct product
      cart.addItem(p2, 1);
      expect(cart.totalQuantity).toBe(6);
      expect(cart.distinctItemCount).toBe(2);

      const events = cart.getUncommittedEvents();
      expect(events).toHaveLength(3);
      expect(events[0]).toBeInstanceOf(CartItemAddedEvent);
    });

    it('enforces maximum quantity limit (20) per product', () => {
      const cart = Cart.create({ guestId: 'guest-1' });
      cart.addItem(p1, 15);

      expect(() => cart.addItem(p1, 6)).toThrow(DomainException); // 15 + 6 = 21 > 20
      expect(() => cart.addItem(p2, 25)).toThrow(DomainException); // > 20
    });

    it('updates item quantity and removes item when quantity is 0', () => {
      const cart = Cart.create({ guestId: 'guest-1' });
      cart.addItem(p1, 5);
      cart.addItem(p2, 2);
      cart.clearEvents();

      cart.updateItemQuantity(p1, 10);
      expect(cart.items.find((i) => i.productId === p1)?.quantity).toBe(10);
      expect(cart.totalQuantity).toBe(12);

      // Setting quantity to 0 removes the item
      cart.updateItemQuantity(p2, 0);
      expect(cart.items.find((i) => i.productId === p2)).toBeUndefined();
      expect(cart.distinctItemCount).toBe(1);
    });

    it('removes item directly via removeItem', () => {
      const cart = Cart.create({ guestId: 'guest-1' });
      cart.addItem(p1, 4);
      cart.addItem(p2, 1);
      cart.clearEvents();

      cart.removeItem(p1);
      expect(cart.distinctItemCount).toBe(1);
      expect(cart.items[0].productId).toBe(p2);
      expect(cart.totalQuantity).toBe(1);

      const events = cart.getUncommittedEvents();
      expect(events).toHaveLength(1);
      expect(events[0]).toBeInstanceOf(CartItemRemovedEvent);
    });

    it('clears all items in the cart', () => {
      const cart = Cart.create({ guestId: 'guest-1' });
      cart.addItem(p1, 4);
      cart.addItem(p2, 2);
      cart.clearEvents();

      cart.clear();
      expect(cart.items).toHaveLength(0);
      expect(cart.totalQuantity).toBe(0);

      const events = cart.getUncommittedEvents();
      expect(events).toHaveLength(1);
      expect(events[0]).toBeInstanceOf(CartClearedEvent);
    });
  });

  describe('Lifecycle State Transitions & Locking', () => {
    it('locks cart during checkout and prevents mutations until unlocked', () => {
      const cart = Cart.create({ customerId: 'cust-1' });
      cart.addItem(p1, 2);

      cart.lock();
      expect(cart.status.isLocked()).toBe(true);

      // Mutations should be forbidden while locked
      expect(() => cart.addItem(p2, 1)).toThrow(DomainException);
      expect(() => cart.updateItemQuantity(p1, 3)).toThrow(DomainException);
      expect(() => cart.removeItem(p1)).toThrow(DomainException);
      expect(() => cart.clear()).toThrow(DomainException);

      // Unlock back to active
      cart.unlock();
      expect(cart.status.isActive()).toBe(true);
      cart.addItem(p2, 1);
      expect(cart.distinctItemCount).toBe(2);
    });

    it('marks cart as converted upon order completion', () => {
      const cart = Cart.create({ customerId: 'cust-1' });
      cart.addItem(p1, 2);
      cart.lock();
      cart.clearEvents();

      const orderId = '00000000-0000-0000-0000-000000000099';
      cart.markConverted(orderId);

      expect(cart.status.isConverted()).toBe(true);
      expect(cart.convertedOrderId).toBe(orderId);

      const events = cart.getUncommittedEvents();
      expect(events).toHaveLength(1);
      expect(events[0]).toBeInstanceOf(CartConvertedEvent);
    });

    it('marks cart as abandoned and reactivates it when customer resumes shopping', () => {
      const cart = Cart.create({ guestId: 'guest-abandoned' });
      cart.addItem(p1, 1);
      cart.clearEvents();

      cart.markAbandoned();
      expect(cart.status.isAbandoned()).toBe(true);

      const events = cart.getUncommittedEvents();
      expect(events[0]).toBeInstanceOf(CartAbandonedEvent);

      // Customer returns and adds another item -> reactivates
      cart.addItem(p2, 2);
      expect(cart.status.isActive()).toBe(true);
      expect(cart.distinctItemCount).toBe(2);
    });
  });

  describe('Guest-to-Customer Cart Merging', () => {
    it('merges guest cart items into customer cart and marks guest cart as merged', () => {
      const guestCart = Cart.create({ guestId: 'guest-session' });
      guestCart.addItem(p1, 3);
      guestCart.addItem(p2, 2);

      const customerCart = Cart.create({ customerId: 'cust-logged-in' });
      customerCart.addItem(p1, 4); // already has 4 of p1
      customerCart.addItem(p3, 1); // has p3

      customerCart.clearEvents();
      customerCart.merge(guestCart);

      expect(guestCart.status.isMerged()).toBe(true);
      expect(customerCart.distinctItemCount).toBe(3); // p1, p2, p3

      // p1 quantity should be 4 + 3 = 7
      expect(customerCart.items.find((i) => i.productId === p1)?.quantity).toBe(
        7,
      );
      // p2 added with quantity 2
      expect(customerCart.items.find((i) => i.productId === p2)?.quantity).toBe(
        2,
      );
      // p3 remains 1
      expect(customerCart.items.find((i) => i.productId === p3)?.quantity).toBe(
        1,
      );

      const events = customerCart.getUncommittedEvents();
      expect(events).toHaveLength(1);
      expect(events[0]).toBeInstanceOf(CartMergedEvent);
    });

    it('caps item quantity at MAX_QUANTITY_PER_ITEM during merge', () => {
      const guestCart = Cart.create({ guestId: 'guest-session' });
      guestCart.addItem(p1, 15);

      const customerCart = Cart.create({ customerId: 'cust-logged-in' });
      customerCart.addItem(p1, 10);

      customerCart.merge(guestCart);

      // 10 + 15 = 25, capped at 20
      expect(customerCart.items.find((i) => i.productId === p1)?.quantity).toBe(
        MAX_QUANTITY_PER_ITEM,
      );
    });
  });

  describe('Optimistic Concurrency Control (OCC)', () => {
    it('increments version on OCC call', () => {
      const cart = Cart.create({ customerId: 'cust-occ' });
      expect(cart.version).toBe(1);

      cart.incrementVersion();
      expect(cart.version).toBe(2);
    });
  });
});
