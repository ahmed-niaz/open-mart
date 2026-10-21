import { Inject, Logger } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';

import { RemoveItemFromCartCommand } from './remove-item-from-cart.command.js';
import {
  CART_REPOSITORY,
  type CartRepositoryPort,
} from '../../ports/cart.repository.js';
import {
  ApplicationException,
  ApplicationExceptionCode,
} from '../../../../shared/domain/exceptions/application.exception.js';

@CommandHandler(RemoveItemFromCartCommand)
export class RemoveItemFromCartCommandHandler implements ICommandHandler<
  RemoveItemFromCartCommand,
  { cartId: string }
> {
  private readonly logger = new Logger(RemoveItemFromCartCommandHandler.name);

  constructor(
    @Inject(CART_REPOSITORY)
    private readonly cartRepository: CartRepositoryPort,
  ) {}

  async execute(
    command: RemoveItemFromCartCommand,
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

    cart.removeItem(command.productId);
    await this.cartRepository.save(cart);

    this.logger.log(
      `Removed product '${command.productId}' from cart '${cart.id.getValue()}'`,
    );

    return { cartId: cart.id.getValue() };
  }
}
