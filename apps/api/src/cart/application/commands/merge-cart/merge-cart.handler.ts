import { Inject, Logger } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';

import { MergeCartCommand } from './merge-cart.command.js';
import {
  CART_REPOSITORY,
  type CartRepositoryPort,
} from '../../ports/cart.repository.js';

@CommandHandler(MergeCartCommand)
export class MergeCartCommandHandler implements ICommandHandler<
  MergeCartCommand,
  { cartId: string | null }
> {
  private readonly logger = new Logger(MergeCartCommandHandler.name);

  constructor(
    @Inject(CART_REPOSITORY)
    private readonly cartRepository: CartRepositoryPort,
  ) {}

  async execute(command: MergeCartCommand): Promise<{ cartId: string | null }> {
    const customerId = command.customerId.trim();
    const guestId = command.guestId.trim();

    this.logger.log(
      `Attempting to merge guest cart '${guestId}' into customer '${customerId}'`,
    );

    const guestCart = await this.cartRepository.findActiveByGuestId(guestId);
    if (!guestCart || guestCart.items.length === 0) {
      // Nothing to merge from guest cart
      const existingCustomerCart =
        await this.cartRepository.findActiveByCustomerId(customerId);
      return {
        cartId: existingCustomerCart
          ? existingCustomerCart.id.getValue()
          : null,
      };
    }

    let customerCart =
      await this.cartRepository.findActiveByCustomerId(customerId);

    if (!customerCart) {
      // No prior customer cart exists; simply claim the guest cart directly
      guestCart.assignCustomer(customerId);
      await this.cartRepository.save(guestCart);
      this.logger.log(
        `Promoted guest cart '${guestCart.id.getValue()}' directly to customer '${customerId}'`,
      );
      return { cartId: guestCart.id.getValue() };
    }

    // Merge items from guestCart into customerCart
    customerCart.merge(guestCart);

    // Save both aggregates to record merged guest cart and updated customer cart
    await this.cartRepository.save(guestCart);
    await this.cartRepository.save(customerCart);

    this.logger.log(
      `Merged guest cart '${guestCart.id.getValue()}' into customer cart '${customerCart.id.getValue()}'`,
    );

    return { cartId: customerCart.id.getValue() };
  }
}
