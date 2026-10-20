import { Inject, Injectable } from '@nestjs/common';
import { inArray } from 'drizzle-orm';
import {
  ProductVerificationPort,
  VerifiedProductData,
} from '../../application/ports/product-verification.port.js';
import {
  DRIZZLE,
  type DrizzleDB,
} from '../../../shared/infrastructure/database/postgres/drizzle.provider.js';
import { productsSchema } from '../../../shared/infrastructure/database/postgres/schema/product.schema.js';

@Injectable()
export class ProductVerificationAdapter implements ProductVerificationPort {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  async getProductsByIds(
    productIds: string[],
  ): Promise<Map<string, VerifiedProductData>> {
    if (productIds.length === 0) {
      return new Map();
    }

    const rows = await this.db
      .select({
        id: productsSchema.id,
        title: productsSchema.title,
        sku: productsSchema.sku,
        unitPriceAmount: productsSchema.unitPriceAmount,
        unitPriceCurrency: productsSchema.unitPriceCurrency,
        status: productsSchema.status,
      })
      .from(productsSchema)
      .where(inArray(productsSchema.id, productIds));

    const map = new Map<string, VerifiedProductData>();
    for (const row of rows) {
      map.set(row.id, {
        id: row.id,
        title: row.title,
        sku: row.sku,
        unitPriceAmount: row.unitPriceAmount,
        unitPriceCurrency: row.unitPriceCurrency,
        status: row.status,
      });
    }

    return map;
  }
}
