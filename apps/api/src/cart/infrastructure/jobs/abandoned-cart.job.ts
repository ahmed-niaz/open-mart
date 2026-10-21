import { Inject, Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';

import {
  CART_REPOSITORY,
  type CartRepositoryPort,
} from '../../application/ports/cart.repository.js';

@Injectable()
export class AbandonedCartJob {
  private readonly logger = new Logger(AbandonedCartJob.name);

  constructor(
    @Inject(CART_REPOSITORY)
    private readonly cartRepository: CartRepositoryPort,
  ) {}

  @Cron(CronExpression.EVERY_HOUR)
  async sweepAbandonedCarts(): Promise<void> {
    const thresholdHours = 24;
    const threshold = new Date(Date.now() - thresholdHours * 60 * 60 * 1000);
    const batchSize = 100;

    try {
      const expiredCarts = await this.cartRepository.findExpiredActiveCarts(
        threshold,
        batchSize,
      );

      if (expiredCarts.length === 0) {
        return;
      }

      this.logger.log(
        `Sweeping ${expiredCarts.length} abandoned cart(s) inactive since ${threshold.toISOString()}`,
      );

      for (const cart of expiredCarts) {
        try {
          cart.markAbandoned();
          await this.cartRepository.save(cart);
        } catch (err: any) {
          this.logger.error(
            `Failed to mark cart '${cart.id.getValue()}' as abandoned: ${err.message}`,
          );
        }
      }
    } catch (err: any) {
      this.logger.error(
        `Error during abandoned cart sweep job: ${err.message}`,
        err.stack,
      );
    }
  }
}
