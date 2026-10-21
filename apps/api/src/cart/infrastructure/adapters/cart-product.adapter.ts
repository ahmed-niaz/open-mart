import { Inject, Injectable } from '@nestjs/common';
import { eq, inArray } from 'drizzle-orm';

import {
  CartProductPort,
  ProductSummary,
} from '../../application/ports/cart-product.port.js';
import {
  DRIZZLE,
  type DrizzleDB,
} from '../../../shared/infrastructure/database/postgres/drizzle.provider.js';
import { productsSchema } from '../../../shared/infrastructure/database/postgres/schema/product.schema.js';

@Injectable()
export class CartProductAdapter implements CartProductPort {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  async getProduct(productId: string): Promise<ProductSummary | null> {
    const rows = await this.db
      .select({
        id: productsSchema.id,
        title: productsSchema.title,
        status: productsSchema.status,
        unitPriceAmount: productsSchema.unitPriceAmount,
        unitPriceCurrency: productsSchema.unitPriceCurrency,
        media: productsSchema.media,
      })
      .from(productsSchema)
      .where(eq(productsSchema.id, productId))
      .limit(1);

    if (rows.length === 0) {
      return null;
    }

    const row = rows[0];
    const thumbnailUrl =
      Array.isArray(row.media) && row.media.length > 0
        ? row.media[0].url
        : null;

    return {
      id: row.id,
      title: row.title,
      sku: '',
      priceCents: row.unitPriceAmount,
      currency: row.unitPriceCurrency,
      isPublished: row.status === 'published',
      thumbnailUrl,
    };
  }

  async getProducts(
    productIds: string[],
  ): Promise<Map<string, ProductSummary>> {
    const map = new Map<string, ProductSummary>();
    if (productIds.length === 0) {
      return map;
    }

    const rows = await this.db
      .select({
        id: productsSchema.id,
        title: productsSchema.title,
        status: productsSchema.status,
        unitPriceAmount: productsSchema.unitPriceAmount,
        unitPriceCurrency: productsSchema.unitPriceCurrency,
        media: productsSchema.media,
      })
      .from(productsSchema)
      .where(inArray(productsSchema.id, productIds));

    for (const row of rows) {
      const thumbnailUrl =
        Array.isArray(row.media) && row.media.length > 0
          ? row.media[0].url
          : null;

      map.set(row.id, {
        id: row.id,
        title: row.title,
        sku: '',
        priceCents: row.unitPriceAmount,
        currency: row.unitPriceCurrency,
        isPublished: row.status === 'published',
        thumbnailUrl,
      });
    }

    return map;
  }
}
