import { Inject, Injectable } from '@nestjs/common';
import { and, eq, inArray, sql } from 'drizzle-orm';

import type {
  DiscountRedemptionRepositoryPort,
  ReserveRedemptionProps,
} from '../../application/ports/discount-redemption.repository.port.js';
import {
  DRIZZLE,
  type DrizzleDB,
} from '../../../shared/infrastructure/database/postgres/drizzle.provider.js';
import { discountRedemptionsSchema } from '../../../shared/infrastructure/database/postgres/schema/discount.schema.js';

@Injectable()
export class DrizzleDiscountRedemptionRepository implements DiscountRedemptionRepositoryPort {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  private getExecutor(tx?: any) {
    return tx || this.db;
  }

  async countByCustomer(
    discountId: string,
    customerIdentifier: string,
    tx?: any,
  ): Promise<number> {
    const executor = this.getExecutor(tx);

    const rows = await executor
      .select({ count: sql<number>`count(*)::int` })
      .from(discountRedemptionsSchema)
      .where(
        and(
          eq(discountRedemptionsSchema.discountId, discountId),
          eq(
            discountRedemptionsSchema.customerIdentifier,
            customerIdentifier.trim().toLowerCase(),
          ),
          inArray(discountRedemptionsSchema.status, ['reserved', 'confirmed']),
        ),
      );

    return Number(rows[0]?.count ?? 0);
  }

  async reserve(props: ReserveRedemptionProps, tx?: any): Promise<void> {
    const executor = this.getExecutor(tx);

    const isUuid =
      props.customerId &&
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
        props.customerId,
      );

    await executor.insert(discountRedemptionsSchema).values({
      discountId: props.discountId,
      orderId: props.orderId,
      customerId: isUuid ? props.customerId : null,
      customerIdentifier: props.customerIdentifier.trim().toLowerCase(),
      discountCode: props.discountCode,
      discountAmount: props.discountAmount,
      status: 'reserved',
      reservedAt: new Date(),
    });
  }

  async confirm(orderId: string, tx?: any): Promise<void> {
    const executor = this.getExecutor(tx);

    await executor
      .update(discountRedemptionsSchema)
      .set({
        status: 'confirmed',
        confirmedAt: new Date(),
      })
      .where(
        and(
          eq(discountRedemptionsSchema.orderId, orderId),
          eq(discountRedemptionsSchema.status, 'reserved'),
        ),
      );
  }

  async release(
    orderId: string,
    tx?: any,
  ): Promise<{ discountId: string } | null> {
    const executor = this.getExecutor(tx);

    const rows = await executor
      .select({ discountId: discountRedemptionsSchema.discountId })
      .from(discountRedemptionsSchema)
      .where(
        and(
          eq(discountRedemptionsSchema.orderId, orderId),
          inArray(discountRedemptionsSchema.status, ['reserved', 'confirmed']),
        ),
      )
      .limit(1);

    if (rows.length === 0) {
      return null;
    }

    await executor
      .update(discountRedemptionsSchema)
      .set({
        status: 'released',
        releasedAt: new Date(),
      })
      .where(
        and(
          eq(discountRedemptionsSchema.orderId, orderId),
          inArray(discountRedemptionsSchema.status, ['reserved', 'confirmed']),
        ),
      );

    return { discountId: rows[0].discountId };
  }
}
