import { Inject, Logger } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';

import { ClearCartCommand } from './clear-cart.command.js';
import {
  CART_REPOSITORY,
  type CartRepositoryPort,
} from '../../ports/cart.repository.js';

@CommandHandler(ClearCartCommand)
export class ClearCartCommandHandler implements ICommandHandler<
  ClearCartCommand,
  { cartId: string | null }
> {
  private readonly logger = new Logger(ClearCartCommandHandler.name);

  constructor(
    @Inject(CART_REPOSITORY)
    private readonly cartRepository: CartRepositoryPort,
  ) {}

  async execute(command: ClearCartCommand): Promise<{ cartId: string | null }> {
    const customerId = command.customerId?.trim() || null;
    const guestId = command.guestId?.trim() || null;

    const cart = customerId
      ? await this.cartRepository.findActiveByCustomerId(customerId)
      : guestId
        ? await this.cartRepository.findActiveByGuestId(guestId)
        : null;

    if (!cart) {
      return { cartId: null };
    }

    cart.clear();
    await this.cartRepository.save(cart);

    this.logger.log(`Cleared all items in cart '${cart.id.getValue()}'`);

    return { cartId: cart.id.getValue() };
  }
}
