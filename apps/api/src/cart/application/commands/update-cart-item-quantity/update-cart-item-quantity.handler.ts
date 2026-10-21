import { Inject, Logger } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';

import { UpdateCartItemQuantityCommand } from './update-cart-item-quantity.command.js';
import {
  CART_REPOSITORY,
  type CartRepositoryPort,
} from '../../ports/cart.repository.js';
import {
  CART_INVENTORY_PORT,
  type CartInventoryPort,
} from '../../ports/cart-inventory.port.js';
import {
  ApplicationException,
  ApplicationExceptionCode,
} from '../../../../shared/domain/exceptions/application.exception.js';

@CommandHandler(UpdateCartItemQuantityCommand)
export class UpdateCartItemQuantityCommandHandler implements ICommandHandler<
  UpdateCartItemQuantityCommand,
  { cartId: string }
> {
  private readonly logger = new Logger(
    UpdateCartItemQuantityCommandHandler.name,
  );

  constructor(
    @Inject(CART_REPOSITORY)
    private readonly cartRepository: CartRepositoryPort,
    @Inject(CART_INVENTORY_PORT)
    private readonly inventoryPort: CartInventoryPort,
  ) {}

  async execute(
    command: UpdateCartItemQuantityCommand,
  ): Promise<{ cartId: string }> {
    const customerId = command.customerId?.trim() || null;
    const guestId = command.guestId?.trim() || null;

    const cart = customerId
      ? await this.cartRepository.findActiveByCustomerId(customerId)
      : guestId
        ? await this.cartRepository.findActiveByGuestId(guestId)
        : null;

    if (!cart) {
      throw new ApplicationException(
        'Active cart not found',
        ApplicationExceptionCode.NOT_FOUND,
      );
    }

    if (command.quantity > 0) {
      const availableStock = await this.inventoryPort.getAvailableStock(
        command.productId,
      );
      if (command.quantity > availableStock) {
        throw new ApplicationException(
          `Requested quantity (${command.quantity}) exceeds available stock (${availableStock})`,
          ApplicationExceptionCode.VALIDATION_ERROR,
        );
      }
    }

    cart.updateItemQuantity(command.productId, command.quantity);
    await this.cartRepository.save(cart);

    this.logger.log(
      `Updated product '${command.productId}' quantity to ${command.quantity} in cart '${cart.id.getValue()}'`,
    );

    return { cartId: cart.id.getValue() };
  }
}
