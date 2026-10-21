import { Inject, Logger } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';

import { AddItemToCartCommand } from './add-item-to-cart.command.js';
import {
  CART_REPOSITORY,
  type CartRepositoryPort,
} from '../../ports/cart.repository.js';
import {
  CART_PRODUCT_PORT,
  type CartProductPort,
} from '../../ports/cart-product.port.js';
import {
  CART_INVENTORY_PORT,
  type CartInventoryPort,
} from '../../ports/cart-inventory.port.js';
import { Cart } from '../../../domain/entities/cart.entity.js';
import {
  ApplicationException,
  ApplicationExceptionCode,
} from '../../../../shared/domain/exceptions/application.exception.js';

@CommandHandler(AddItemToCartCommand)
export class AddItemToCartCommandHandler implements ICommandHandler<
  AddItemToCartCommand,
  { cartId: string }
> {
  private readonly logger = new Logger(AddItemToCartCommandHandler.name);

  constructor(
    @Inject(CART_REPOSITORY)
    private readonly cartRepository: CartRepositoryPort,
    @Inject(CART_PRODUCT_PORT)
    private readonly productPort: CartProductPort,
    @Inject(CART_INVENTORY_PORT)
    private readonly inventoryPort: CartInventoryPort,
  ) {}

  async execute(command: AddItemToCartCommand): Promise<{ cartId: string }> {
    const customerId = command.customerId?.trim() || null;
    const guestId = command.guestId?.trim() || null;

    if (!customerId && !guestId) {
      throw new ApplicationException(
        'Either customerId or guestId must be provided to interact with cart',
        ApplicationExceptionCode.VALIDATION_ERROR,
      );
    }

    // 1. Revalidate Product Existence & Status
    const product = await this.productPort.getProduct(command.productId);
    if (!product) {
      throw new ApplicationException(
        `Product '${command.productId}' was not found in catalog`,
        ApplicationExceptionCode.NOT_FOUND,
      );
    }
    if (!product.isPublished) {
      throw new ApplicationException(
        `Product '${product.title}' is currently unavailable for purchase`,
        ApplicationExceptionCode.VALIDATION_ERROR,
      );
    }

    // 2. Revalidate Available Stock
    const availableStock = await this.inventoryPort.getAvailableStock(
      command.productId,
    );
    if (availableStock <= 0) {
      throw new ApplicationException(
        `Product '${product.title}' is out of stock`,
        ApplicationExceptionCode.VALIDATION_ERROR,
      );
    }

    // 3. Resolve or Create Active Cart
    let cart: Cart | null = null;
    if (customerId) {
      cart = await this.cartRepository.findActiveByCustomerId(customerId);
    } else if (guestId) {
      cart = await this.cartRepository.findActiveByGuestId(guestId);
    }

    if (!cart) {
      cart = Cart.create({
        customerId,
        guestId,
      });
    }

    // 4. Check that new total doesn't exceed available physical stock
    const existingItem = cart.items.find(
      (item) => item.productId === command.productId,
    );
    const existingQuantity = existingItem ? existingItem.quantity : 0;
    const requestedTotal = existingQuantity + command.quantity;

    if (requestedTotal > availableStock) {
      throw new ApplicationException(
        `Cannot add ${command.quantity} more unit(s). Only ${availableStock} unit(s) available in stock (Cart already has ${existingQuantity}).`,
        ApplicationExceptionCode.VALIDATION_ERROR,
      );
    }

    // 5. Mutate Aggregate & Save
    cart.addItem(command.productId, command.quantity);
    await this.cartRepository.save(cart);

    this.logger.log(
      `Added ${command.quantity}x product '${command.productId}' to cart '${cart.id.getValue()}'`,
    );

    return { cartId: cart.id.getValue() };
  }
}
