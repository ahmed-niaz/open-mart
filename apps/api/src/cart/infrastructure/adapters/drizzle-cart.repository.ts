import { Inject, Injectable } from '@nestjs/common';
import { and, desc, eq, inArray, lt } from 'drizzle-orm';

import { CartRepositoryPort } from '../../application/ports/cart.repository.js';
import { Cart } from '../../domain/entities/cart.entity.js';
import { CartItem } from '../../domain/entities/cart-item.entity.js';
import { CartId } from '../../domain/value-objects/cart-id.vo.js';
import { CartStatus } from '../../domain/value-objects/cart-status.vo.js';
import {
  DRIZZLE,
  type DrizzleDB,
} from '../../../shared/infrastructure/database/postgres/drizzle.provider.js';
import {
  cartItemsSchema,
  cartsSchema,
} from '../../../shared/infrastructure/database/postgres/schema/cart.schema.js';
import {
  ApplicationException,
  ApplicationExceptionCode,
} from '../../../shared/domain/exceptions/application.exception.js';
import { OutboxService } from '../../../shared/infrastructure/outbox/outbox.service.js';

@Injectable()
export class DrizzleCartRepository implements CartRepositoryPort {
  constructor(
    @Inject(DRIZZLE) private readonly db: DrizzleDB,
    private readonly outboxService: OutboxService,
  ) {}

  async save(cart: Cart): Promise<void> {
    await this.db.transaction(async (trx) => {
      const existing = await trx
        .select({ id: cartsSchema.id, version: cartsSchema.version })
        .from(cartsSchema)
        .where(eq(cartsSchema.id, cart.id.getValue()))
        .limit(1);

      if (existing.length === 0) {
        await trx.insert(cartsSchema).values({
          id: cart.id.getValue(),
          customerId: cart.customerId,
          guestId: cart.guestId,
          status: cart.status.getValue(),
          currency: cart.currency,
          convertedOrderId: cart.convertedOrderId,
          lastActivityAt: cart.lastActivityAt,
          version: cart.version,
          createdAt: cart.createdAt,
          updatedAt: cart.updatedAt,
        });
      } else {
        const currentVersion = cart.version;
        cart.incrementVersion();
        const nextVersion = cart.version;

        const updated = await trx
          .update(cartsSchema)
          .set({
            customerId: cart.customerId,
            guestId: cart.guestId,
            status: cart.status.getValue(),
            currency: cart.currency,
            convertedOrderId: cart.convertedOrderId,
            lastActivityAt: cart.lastActivityAt,
            version: nextVersion,
            updatedAt: new Date(),
          })
          .where(
            and(
              eq(cartsSchema.id, cart.id.getValue()),
              eq(cartsSchema.version, currentVersion),
            ),
          )
          .returning({ id: cartsSchema.id });

        if (updated.length === 0) {
          throw new ApplicationException(
            `Cart '${cart.id.getValue()}' was modified by another transaction. Concurrency conflict.`,
            ApplicationExceptionCode.CONFLICT,
          );
        }
      }

      // Sync Cart Items
      const activeItemIds = cart.items.map((i) => i.id);

      // Remove deleted items
      if (activeItemIds.length === 0) {
        await trx
          .delete(cartItemsSchema)
          .where(eq(cartItemsSchema.cartId, cart.id.getValue()));
      } else {
        const existingItems = await trx
          .select({ id: cartItemsSchema.id })
          .from(cartItemsSchema)
          .where(eq(cartItemsSchema.cartId, cart.id.getValue()));

        const existingIds = new Set(existingItems.map((r) => r.id));

        // Delete items no longer in cart
        const idsToDelete = existingItems
          .map((r) => r.id)
          .filter((id) => !activeItemIds.includes(id));

        if (idsToDelete.length > 0) {
          await trx
            .delete(cartItemsSchema)
            .where(
              and(
                eq(cartItemsSchema.cartId, cart.id.getValue()),
                inArray(cartItemsSchema.id, idsToDelete),
              ),
            );
        }

        // Upsert active items
        for (const item of cart.items) {
          if (existingIds.has(item.id)) {
            await trx
              .update(cartItemsSchema)
              .set({
                quantity: item.quantity,
                updatedAt: item.updatedAt,
              })
              .where(eq(cartItemsSchema.id, item.id));
          } else {
            await trx.insert(cartItemsSchema).values({
              id: item.id,
              cartId: item.cartId,
              productId: item.productId,
              quantity: item.quantity,
              createdAt: item.createdAt,
              updatedAt: item.updatedAt,
            });
          }
        }
      }

      // Stage events into Outbox atomically
      const uncommittedEvents = cart.getUncommittedEvents();
      if (uncommittedEvents.length > 0) {
        await this.outboxService.stageEvents(
          trx,
          'Cart',
          cart.id.getValue(),
          uncommittedEvents,
        );
      }
    });

    cart.clearEvents();
    this.outboxService.triggerSweep();
  }

  async findById(id: CartId): Promise<Cart | null> {
    const rows = await this.db
      .select()
      .from(cartsSchema)
      .where(eq(cartsSchema.id, id.getValue()))
      .limit(1);

    if (rows.length === 0) {
      return null;
    }

    const itemRows = await this.db
      .select()
      .from(cartItemsSchema)
      .where(eq(cartItemsSchema.cartId, id.getValue()))
      .orderBy(desc(cartItemsSchema.createdAt));

    return this.toDomain(rows[0], itemRows);
  }

  async findActiveByCustomerId(customerId: string): Promise<Cart | null> {
    const rows = await this.db
      .select()
      .from(cartsSchema)
      .where(
        and(
          eq(cartsSchema.customerId, customerId),
          eq(cartsSchema.status, 'active'),
        ),
      )
      .orderBy(desc(cartsSchema.updatedAt))
      .limit(1);

    if (rows.length === 0) {
      return null;
    }

    const itemRows = await this.db
      .select()
      .from(cartItemsSchema)
      .where(eq(cartItemsSchema.cartId, rows[0].id))
      .orderBy(desc(cartItemsSchema.createdAt));

    return this.toDomain(rows[0], itemRows);
  }

  async findActiveByGuestId(guestId: string): Promise<Cart | null> {
    const rows = await this.db
      .select()
      .from(cartsSchema)
      .where(
        and(eq(cartsSchema.guestId, guestId), eq(cartsSchema.status, 'active')),
      )
      .orderBy(desc(cartsSchema.updatedAt))
      .limit(1);

    if (rows.length === 0) {
      return null;
    }

    const itemRows = await this.db
      .select()
      .from(cartItemsSchema)
      .where(eq(cartItemsSchema.cartId, rows[0].id))
      .orderBy(desc(cartItemsSchema.createdAt));

    return this.toDomain(rows[0], itemRows);
  }

  async findExpiredActiveCarts(
    threshold: Date,
    limit: number,
  ): Promise<Cart[]> {
    const rows = await this.db
      .select()
      .from(cartsSchema)
      .where(
        and(
          eq(cartsSchema.status, 'active'),
          lt(cartsSchema.lastActivityAt, threshold),
        ),
      )
      .limit(limit);

    if (rows.length === 0) {
      return [];
    }

    const cartIds = rows.map((r) => r.id);
    const itemRows = await this.db
      .select()
      .from(cartItemsSchema)
      .where(inArray(cartItemsSchema.cartId, cartIds));

    const itemsByCart = new Map<string, typeof itemRows>();
    for (const item of itemRows) {
      const list = itemsByCart.get(item.cartId) ?? [];
      list.push(item);
      itemsByCart.set(item.cartId, list);
    }

    return rows.map((row) => this.toDomain(row, itemsByCart.get(row.id) ?? []));
  }

  private toDomain(
    row: typeof cartsSchema.$inferSelect,
    itemRows: (typeof cartItemsSchema.$inferSelect)[],
  ): Cart {
    const items = itemRows.map((item) =>
      CartItem.reconstitute({
        id: item.id,
        cartId: item.cartId,
        productId: item.productId,
        quantity: item.quantity,
        createdAt: item.createdAt,
        updatedAt: item.updatedAt,
      }),
    );

    return Cart.reconstitute({
      id: CartId.fromString(row.id),
      customerId: row.customerId,
      guestId: row.guestId,
      status: CartStatus.fromString(row.status),
      currency: row.currency,
      convertedOrderId: row.convertedOrderId,
      lastActivityAt: row.lastActivityAt,
      version: row.version,
      items,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    });
  }
}
