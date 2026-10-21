import { Inject, Logger } from '@nestjs/common';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { and, desc, eq } from 'drizzle-orm';

import { GetCartQuery } from './get-cart.query.js';
import {
  CartItemResponseDto,
  CartResponseDto,
} from '../../dto/cart-response.dto.js';
import {
  DRIZZLE,
  type DrizzleDB,
} from '../../../../shared/infrastructure/database/postgres/drizzle.provider.js';
import {
  cartItemsSchema,
  cartsSchema,
} from '../../../../shared/infrastructure/database/postgres/schema/cart.schema.js';
import { productsSchema } from '../../../../shared/infrastructure/database/postgres/schema/product.schema.js';
import { inventoryItemsSchema } from '../../../../shared/infrastructure/database/postgres/schema/inventory.schema.js';

@QueryHandler(GetCartQuery)
export class GetCartQueryHandler implements IQueryHandler<
  GetCartQuery,
  CartResponseDto
> {
  private readonly logger = new Logger(GetCartQueryHandler.name);

  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  async execute(query: GetCartQuery): Promise<CartResponseDto> {
    const customerId = query.customerId?.trim() || null;
    const guestId = query.guestId?.trim() || null;

    if (!customerId && !guestId) {
      return this.emptyCartResponse();
    }

    // 1. Fetch active cart
    const cartWhere = customerId
      ? and(
          eq(cartsSchema.customerId, customerId),
          eq(cartsSchema.status, 'active'),
        )
      : and(
          eq(cartsSchema.guestId, guestId!),
          eq(cartsSchema.status, 'active'),
        );

    const carts = await this.db
      .select()
      .from(cartsSchema)
      .where(cartWhere)
      .orderBy(desc(cartsSchema.updatedAt))
      .limit(1);

    if (carts.length === 0) {
      return this.emptyCartResponse();
    }

    const cart = carts[0];

    // 2. Query items joined with live product and inventory records
    const rawItems = await this.db
      .select({
        cartItemId: cartItemsSchema.id,
        productId: cartItemsSchema.productId,
        quantity: cartItemsSchema.quantity,
        title: productsSchema.title,
        status: productsSchema.status,
        unitPriceAmount: productsSchema.unitPriceAmount,
        unitPriceCurrency: productsSchema.unitPriceCurrency,
        media: productsSchema.media,
        sku: inventoryItemsSchema.sku,
        quantityOnHand: inventoryItemsSchema.quantityOnHand,
        reservedQuantity: inventoryItemsSchema.reservedQuantity,
        isInventoryActive: inventoryItemsSchema.isActive,
      })
      .from(cartItemsSchema)
      .leftJoin(
        productsSchema,
        eq(cartItemsSchema.productId, productsSchema.id),
      )
      .leftJoin(
        inventoryItemsSchema,
        eq(cartItemsSchema.productId, inventoryItemsSchema.productId),
      )
      .where(eq(cartItemsSchema.cartId, cart.id));

    // 3. Map to projection with live pricing & stock availability checks
    let subtotalCents = 0;
    let totalQuantity = 0;
    let hasUnavailableItems = false;

    const items: CartItemResponseDto[] = rawItems.map((row) => {
      const isPublished = row.status === 'published';
      const availableStock = Math.max(
        0,
        (row.quantityOnHand ?? 0) - (row.reservedQuantity ?? 0),
      );
      const isAvailable =
        Boolean(isPublished) &&
        Boolean(row.isInventoryActive ?? true) &&
        availableStock >= row.quantity;

      if (!isAvailable) {
        hasUnavailableItems = true;
      }

      const unitPriceCents = row.unitPriceAmount ?? 0;
      const lineTotalCents = unitPriceCents * row.quantity;

      subtotalCents += lineTotalCents;
      totalQuantity += row.quantity;

      const thumbnailUrl =
        Array.isArray(row.media) && row.media.length > 0
          ? row.media[0].url
          : null;

      return {
        id: row.cartItemId,
        productId: row.productId,
        title: row.title ?? 'Unknown Product',
        sku: row.sku ?? 'N/A',
        thumbnailUrl,
        unitPriceCents,
        currency: row.unitPriceCurrency ?? cart.currency,
        quantity: row.quantity,
        lineTotalCents,
        availableStock,
        isAvailable,
      };
    });

    return {
      id: cart.id,
      customerId: cart.customerId,
      guestId: cart.guestId,
      status: cart.status,
      currency: cart.currency,
      items,
      totalQuantity,
      subtotalCents,
      hasUnavailableItems,
      updatedAt: cart.updatedAt.toISOString(),
    };
  }

  private emptyCartResponse(): CartResponseDto {
    return {
      id: '',
      customerId: null,
      guestId: null,
      status: 'active',
      currency: 'BDT',
      items: [],
      totalQuantity: 0,
      subtotalCents: 0,
      hasUnavailableItems: false,
      updatedAt: new Date().toISOString(),
    };
  }
}
