import { describe, expect, it, vi, beforeEach } from 'vitest';
import { AddItemToCartCommandHandler } from '../../src/cart/application/commands/add-item-to-cart/add-item-to-cart.handler.js';
import { AddItemToCartCommand } from '../../src/cart/application/commands/add-item-to-cart/add-item-to-cart.command.js';
import { UpdateCartItemQuantityCommandHandler } from '../../src/cart/application/commands/update-cart-item-quantity/update-cart-item-quantity.handler.js';
import { UpdateCartItemQuantityCommand } from '../../src/cart/application/commands/update-cart-item-quantity/update-cart-item-quantity.command.js';
import { RemoveItemFromCartCommandHandler } from '../../src/cart/application/commands/remove-item-from-cart/remove-item-from-cart.handler.js';
import { RemoveItemFromCartCommand } from '../../src/cart/application/commands/remove-item-from-cart/remove-item-from-cart.command.js';
import { ClearCartCommandHandler } from '../../src/cart/application/commands/clear-cart/clear-cart.handler.js';
import { ClearCartCommand } from '../../src/cart/application/commands/clear-cart/clear-cart.command.js';
import { MergeCartCommandHandler } from '../../src/cart/application/commands/merge-cart/merge-cart.handler.js';
import { MergeCartCommand } from '../../src/cart/application/commands/merge-cart/merge-cart.command.js';
import { OrderPlacedCartHandler } from '../../src/cart/application/event-handlers/order-placed.event-handler.js';
import { OrderPlacedEvent } from '../../src/order/domain/events/order-placed.event.js';
import { Cart } from '../../src/cart/domain/entities/cart.entity.js';
import type { CartRepositoryPort } from '../../src/cart/application/ports/cart.repository.js';
import type { CartProductPort } from '../../src/cart/application/ports/cart-product.port.js';
import type { CartInventoryPort } from '../../src/cart/application/ports/cart-inventory.port.js';
import { ApplicationException } from '../../src/shared/domain/exceptions/application.exception.js';

describe('Cart Command Handlers (Application Layer)', () => {
  const p1 = '00000000-0000-0000-0000-000000000001';
  const customerId = 'cust-123';
  const guestId = 'guest-456';

  let mockRepo: Partial<CartRepositoryPort>;
  let mockProductPort: Partial<CartProductPort>;
  let mockInventoryPort: Partial<CartInventoryPort>;

  beforeEach(() => {
    mockRepo = {
      save: vi.fn().mockResolvedValue(undefined),
      findActiveByCustomerId: vi.fn().mockResolvedValue(null),
      findActiveByGuestId: vi.fn().mockResolvedValue(null),
    };

    mockProductPort = {
      getProduct: vi.fn().mockResolvedValue({
        id: p1,
        title: 'Premium Panjabi',
        sku: 'PAN-001',
        priceCents: 450000,
        currency: 'BDT',
        isPublished: true,
        thumbnailUrl: null,
      }),
    };

    mockInventoryPort = {
      getAvailableStock: vi.fn().mockResolvedValue(10), // 10 units in stock
    };
  });

  describe('AddItemToCartCommandHandler', () => {
    it('creates a new guest cart and adds product when stock is sufficient', async () => {
      const handler = new AddItemToCartCommandHandler(
        mockRepo as CartRepositoryPort,
        mockProductPort as CartProductPort,
        mockInventoryPort as CartInventoryPort,
      );

      const result = await handler.execute(
        new AddItemToCartCommand(p1, 2, null, guestId),
      );

      expect(result.cartId).toBeDefined();
      expect(mockRepo.save).toHaveBeenCalledTimes(1);
      const savedCart = (mockRepo.save as any).mock.calls[0][0] as Cart;
      expect(savedCart.guestId).toBe(guestId);
      expect(savedCart.items).toHaveLength(1);
      expect(savedCart.items[0].quantity).toBe(2);
    });

    it('rejects adding product if unpublished in catalog', async () => {
      (mockProductPort.getProduct as any).mockResolvedValue({
        id: p1,
        title: 'Draft Product',
        sku: 'DRF-001',
        priceCents: 1000,
        currency: 'BDT',
        isPublished: false,
        thumbnailUrl: null,
      });

      const handler = new AddItemToCartCommandHandler(
        mockRepo as CartRepositoryPort,
        mockProductPort as CartProductPort,
        mockInventoryPort as CartInventoryPort,
      );

      await expect(
        handler.execute(new AddItemToCartCommand(p1, 1, customerId, null)),
      ).rejects.toThrow(ApplicationException);
    });

    it('rejects adding more units than physical available stock', async () => {
      (mockInventoryPort.getAvailableStock as any).mockResolvedValue(3); // only 3 in stock

      const handler = new AddItemToCartCommandHandler(
        mockRepo as CartRepositoryPort,
        mockProductPort as CartProductPort,
        mockInventoryPort as CartInventoryPort,
      );

      await expect(
        handler.execute(new AddItemToCartCommand(p1, 5, customerId, null)), // requested 5
      ).rejects.toThrow(ApplicationException);
    });
  });

  describe('UpdateCartItemQuantityCommandHandler', () => {
    it('updates quantity when available stock allows it', async () => {
      const cart = Cart.create({ customerId });
      cart.addItem(p1, 2);
      (mockRepo.findActiveByCustomerId as any).mockResolvedValue(cart);
      (mockInventoryPort.getAvailableStock as any).mockResolvedValue(15);

      const handler = new UpdateCartItemQuantityCommandHandler(
        mockRepo as CartRepositoryPort,
        mockInventoryPort as CartInventoryPort,
      );

      const result = await handler.execute(
        new UpdateCartItemQuantityCommand(p1, 5, customerId, null),
      );

      expect(result.cartId).toBe(cart.id.getValue());
      expect(cart.items[0].quantity).toBe(5);
      expect(mockRepo.save).toHaveBeenCalledWith(cart);
    });

    it('rejects increasing quantity past available stock', async () => {
      const cart = Cart.create({ customerId });
      cart.addItem(p1, 2);
      (mockRepo.findActiveByCustomerId as any).mockResolvedValue(cart);
      (mockInventoryPort.getAvailableStock as any).mockResolvedValue(4); // only 4 in stock

      const handler = new UpdateCartItemQuantityCommandHandler(
        mockRepo as CartRepositoryPort,
        mockInventoryPort as CartInventoryPort,
      );

      await expect(
        handler.execute(
          new UpdateCartItemQuantityCommand(p1, 8, customerId, null),
        ),
      ).rejects.toThrow(ApplicationException);
    });
  });

  describe('RemoveItemFromCartCommandHandler', () => {
    it('removes an existing product from customer cart and saves', async () => {
      const cart = Cart.create({ customerId });
      cart.addItem(p1, 2);
      (mockRepo.findActiveByCustomerId as any).mockResolvedValue(cart);

      const handler = new RemoveItemFromCartCommandHandler(
        mockRepo as CartRepositoryPort,
      );

      const result = await handler.execute(
        new RemoveItemFromCartCommand(p1, customerId, null),
      );

      expect(result.cartId).toBe(cart.id.getValue());
      expect(cart.items).toHaveLength(0);
      expect(mockRepo.save).toHaveBeenCalledWith(cart);
    });

    it('throws ApplicationException if active cart is not found', async () => {
      (mockRepo.findActiveByCustomerId as any).mockResolvedValue(null);

      const handler = new RemoveItemFromCartCommandHandler(
        mockRepo as CartRepositoryPort,
      );

      await expect(
        handler.execute(new RemoveItemFromCartCommand(p1, customerId, null)),
      ).rejects.toThrow(ApplicationException);
    });
  });

  describe('ClearCartCommandHandler', () => {
    it('clears all items from cart and saves', async () => {
      const cart = Cart.create({ customerId });
      cart.addItem(p1, 2);
      (mockRepo.findActiveByCustomerId as any).mockResolvedValue(cart);

      const handler = new ClearCartCommandHandler(
        mockRepo as CartRepositoryPort,
      );

      const result = await handler.execute(
        new ClearCartCommand(customerId, null),
      );

      expect(result.cartId).toBe(cart.id.getValue());
      expect(cart.items).toHaveLength(0);
      expect(mockRepo.save).toHaveBeenCalledWith(cart);
    });

    it('returns null cartId idempotently if active cart is not found', async () => {
      (mockRepo.findActiveByCustomerId as any).mockResolvedValue(null);

      const handler = new ClearCartCommandHandler(
        mockRepo as CartRepositoryPort,
      );

      const result = await handler.execute(
        new ClearCartCommand(customerId, null),
      );

      expect(result.cartId).toBeNull();
      expect(mockRepo.save).not.toHaveBeenCalled();
    });
  });

  describe('MergeCartCommandHandler', () => {
    it('merges guest cart into customer cart and saves both', async () => {
      const guestCart = Cart.create({ guestId });
      guestCart.addItem(p1, 3);

      const customerCart = Cart.create({ customerId });
      customerCart.addItem(p1, 2);

      (mockRepo.findActiveByGuestId as any).mockResolvedValue(guestCart);
      (mockRepo.findActiveByCustomerId as any).mockResolvedValue(customerCart);

      const handler = new MergeCartCommandHandler(
        mockRepo as CartRepositoryPort,
      );

      const result = await handler.execute(
        new MergeCartCommand(customerId, guestId),
      );

      expect(result.cartId).toBe(customerCart.id.getValue());
      expect(customerCart.items[0].quantity).toBe(5);
      expect(guestCart.status.isMerged()).toBe(true);
      expect(mockRepo.save).toHaveBeenCalledTimes(2);
    });

    it('promotes guest cart directly to customer if customer has no prior cart', async () => {
      const guestCart = Cart.create({ guestId });
      guestCart.addItem(p1, 3);

      (mockRepo.findActiveByGuestId as any).mockResolvedValue(guestCart);
      (mockRepo.findActiveByCustomerId as any).mockResolvedValue(null);

      const handler = new MergeCartCommandHandler(
        mockRepo as CartRepositoryPort,
      );

      const result = await handler.execute(
        new MergeCartCommand(customerId, guestId),
      );

      expect(result.cartId).toBe(guestCart.id.getValue());
      expect(guestCart.customerId).toBe(customerId);
      expect(mockRepo.save).toHaveBeenCalledWith(guestCart);
    });
  });

  describe('OrderPlacedCartHandler', () => {
    it('marks customer active cart converted and retains items for audit history upon order placement', async () => {
      const cart = Cart.create({ customerId });
      cart.addItem(p1, 2);

      (mockRepo.findActiveByCustomerId as any).mockResolvedValue(cart);

      const mockEventDeduplication = {
        executeIdempotently: vi
          .fn()
          .mockImplementation((_id, _name, fn) => fn()),
      };

      const handler = new OrderPlacedCartHandler(
        mockRepo as CartRepositoryPort,
        mockEventDeduplication as any,
      );

      const orderId = '00000000-0000-0000-0000-000000000099';
      await handler.handle(
        new OrderPlacedEvent(
          orderId,
          customerId,
          5000,
          'BDT',
          {
            recipientName: 'Alice',
            recipientPhone: '01711111111',
            division: 'Dhaka',
            district: 'Dhaka',
            city: 'Dhaka',
            area: 'Dhanmondi',
            addressLine: 'House 1',
          },
          [
            {
              productId: p1,
              productName: 'Panjabi',
              productSku: 'PAN-01',
              unitPriceAmount: 2500,
              quantity: 2,
            },
          ],
        ),
      );

      expect(cart.status.isConverted()).toBe(true);
      expect(cart.convertedOrderId).toBe(orderId);
      expect(cart.items).toHaveLength(1);
      expect(mockRepo.save).toHaveBeenCalledWith(cart);
    });
  });
});
