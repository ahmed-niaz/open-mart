import { Inject, Injectable, Optional } from '@nestjs/common';
import { and, eq, gte, inArray, lte, sql, SQL } from 'drizzle-orm';
import {
  ProductFilters,
  ProductRepositoryPort,
} from '../../application/ports/product.repository.js';
import {
  Product,
  ProductCategory,
  ProductMedia,
  ProductStatus,
  ProductVariant,
} from '../../domain/entities/product.entity.js';
import { ProductId } from '../../domain/value-objects/product-id.vo.js';
import { SKU } from '../../domain/value-objects/sku.vo.js';
import { Money } from '../../../shared/domain/value-objects/money.vo.js';
import {
  ApplicationException,
  ApplicationExceptionCode,
} from '../../../shared/domain/exceptions/application.exception.js';
import { DRIZZLE } from '../../../shared/infrastructure/database/postgres/drizzle.provider.js';
import type { DrizzleDB } from '../../../shared/infrastructure/database/postgres/drizzle.provider.js';
import {
  ProductInsertRow,
  ProductSelectRow,
  productsSchema,
  ProductVariantPersistence,
} from '../../../shared/infrastructure/database/postgres/schema/product.schema.js';
import { cartItemsSchema } from '../../../shared/infrastructure/database/postgres/schema/cart.schema.js';
import { discountTargetProductsSchema } from '../../../shared/infrastructure/database/postgres/schema/discount.schema.js';
import {
  inventoryItemsSchema,
  inventoryMovementsSchema,
  inventoryReservationsSchema,
} from '../../../shared/infrastructure/database/postgres/schema/inventory.schema.js';
import { orderItemsSchema } from '../../../shared/infrastructure/database/postgres/schema/order.schema.js';
import { mediaAssetsSchema } from '../../../shared/infrastructure/database/postgres/schema/media.schema.js';
import { CacheService } from '../../../shared/infrastructure/cache/cache.service.js';

@Injectable()
export class DrizzleProductRepository implements ProductRepositoryPort {
  constructor(
    @Inject(DRIZZLE) private readonly db: DrizzleDB,
    @Optional() private readonly cacheService?: CacheService,
  ) {}

  // 1. SAVE PRODUCT (Supports Insert and Optimistic Concurrency Control Update)
  async save(product: Product): Promise<void> {
    const row = DrizzleProductRepository.toPersistence(product);

    const existingRows = await this.db
      .select({ id: productsSchema.id, version: productsSchema.version })
      .from(productsSchema)
      .where(eq(productsSchema.id, product.id.getValue()))
      .limit(1);

    if (existingRows.length === 0) {
      // Insert new product
      await this.db.insert(productsSchema).values(row);
      await this.invalidateProductCache(product);
      return;
    }

    // OCC Update: check and increment version atomically
    const currentVersion = product.version;
    const nextVersion = currentVersion + 1;

    const updated = await this.db
      .update(productsSchema)
      .set({
        title: row.title,
        description: row.description,
        media: row.media,
        tags: row.tags,
        status: row.status,
        categoryId: row.categoryId,
        category: row.category,
        unitPriceAmount: row.unitPriceAmount,
        unitPriceCurrency: row.unitPriceCurrency,
        basePriceAmount: row.basePriceAmount,
        basePriceCurrency: row.basePriceCurrency,
        compareAtPriceAmount: row.compareAtPriceAmount,
        compareAtPriceCurrency: row.compareAtPriceCurrency,
        sku: row.sku,
        inventoryQuantity: row.inventoryQuantity,
        trackQuantity: row.trackQuantity,
        variants: row.variants,
        version: nextVersion,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(productsSchema.id, product.id.getValue()),
          eq(productsSchema.version, currentVersion),
        ),
      )
      .returning({ id: productsSchema.id });

    if (updated.length === 0) {
      throw new ApplicationException(
        `Optimistic lock failure: Product '${product.id.getValue()}' was modified by another process.`,
        ApplicationExceptionCode.CONFLICT,
      );
    }

    product.incrementVersion();
    await this.invalidateProductCache(product);
  }

  private async invalidateProductCache(product: Product): Promise<void> {
    if (!this.cacheService) return;
    try {
      await this.cacheService.del(`product:id:${product.id.getValue()}`);
      await this.cacheService.del(`product:sku:${product.sku.getValue()}`);
      for (const variant of product.variants) {
        if (variant.sku) {
          await this.cacheService.del(`product:sku:${variant.sku.getValue()}`);
        }
      }
      await this.cacheService.delPattern('product:list:*');
    } catch {
      // Fail-open: cache eviction errors must not fail database transaction
    }
  }

  // 2. FIND BY ID
  async findById(id: ProductId): Promise<Product | null> {
    const rows = await this.db
      .select()
      .from(productsSchema)
      .where(eq(productsSchema.id, id.getValue()))
      .limit(1);

    if (!rows[0]) return null;
    return DrizzleProductRepository.toDomain(rows[0]);
  }

  // 3. FIND BY SKU
  async findBySku(sku: SKU): Promise<Product | null> {
    const rows = await this.db
      .select()
      .from(productsSchema)
      .where(eq(productsSchema.sku, sku.getValue()))
      .limit(1);

    if (!rows[0]) return null;
    return DrizzleProductRepository.toDomain(rows[0]);
  }

  // 4. FIND BY TITLE
  async findByTitle(title: string): Promise<Product | null> {
    const rows = await this.db
      .select()
      .from(productsSchema)
      .where(eq(productsSchema.title, title.trim()))
      .limit(1);

    if (!rows[0]) return null;
    return DrizzleProductRepository.toDomain(rows[0]);
  }

  // 5. FIND ALL WITH FILTERS
  async findAll(filters: ProductFilters): Promise<Product[]> {
    const conditions: SQL[] = [];

    if (filters.status) {
      conditions.push(eq(productsSchema.status, filters.status));
    }

    if (filters.minPrice !== undefined) {
      conditions.push(
        gte(productsSchema.unitPriceAmount, Math.round(filters.minPrice * 100)),
      );
    }

    if (filters.maxPrice !== undefined) {
      conditions.push(
        lte(productsSchema.unitPriceAmount, Math.round(filters.maxPrice * 100)),
      );
    }

    const query = this.db.select().from(productsSchema);
    const rows =
      conditions.length > 0
        ? await query.where(and(...conditions))
        : await query;

    return rows.map((row) => DrizzleProductRepository.toDomain(row));
  }

  // 6. DELETE (Permanently removes record from database with transactional cascade)
  async delete(id: ProductId): Promise<void> {
    const productIdStr = id.getValue();

    const deleted = await this.db.transaction(async (tx) => {
      // 1. Remove references in cart_items and discount_target_products if they exist
      await tx
        .delete(cartItemsSchema)
        .where(eq(cartItemsSchema.productId, productIdStr));

      await tx
        .delete(discountTargetProductsSchema)
        .where(eq(discountTargetProductsSchema.productId, productIdStr));

      // 2. Remove inventory records (reservations -> movements -> inventory_items)
      const invItems = await tx
        .select({ id: inventoryItemsSchema.id })
        .from(inventoryItemsSchema)
        .where(eq(inventoryItemsSchema.productId, productIdStr));

      if (invItems.length > 0) {
        const invItemIds = invItems.map((item) => item.id);
        await tx
          .delete(inventoryReservationsSchema)
          .where(
            inArray(inventoryReservationsSchema.inventoryItemId, invItemIds),
          );
        await tx
          .delete(inventoryMovementsSchema)
          .where(inArray(inventoryMovementsSchema.inventoryItemId, invItemIds));
        await tx
          .delete(inventoryItemsSchema)
          .where(eq(inventoryItemsSchema.productId, productIdStr));
      }

      // 3. Historical order_items preserve frozen price snapshots; set productId to null
      await tx
        .update(orderItemsSchema)
        .set({ productId: null })
        .where(eq(orderItemsSchema.productId, productIdStr));

      // 4. Delete the product itself
      const rows = await tx
        .delete(productsSchema)
        .where(eq(productsSchema.id, productIdStr))
        .returning({
          id: productsSchema.id,
          sku: productsSchema.sku,
          variants: productsSchema.variants,
          media: productsSchema.media,
        });

      // 5. Decrement usage_count for any media assets attached to this product
      // Note: Media assets and cloud storage files remain safely in the Media Library for reuse or manual deletion
      if (rows[0]?.media && Array.isArray(rows[0].media)) {
        for (const item of rows[0].media) {
          if (item?.url) {
            await tx
              .update(mediaAssetsSchema)
              .set({
                usageCount: sql`GREATEST(0, ${mediaAssetsSchema.usageCount} - 1)`,
                updatedAt: new Date(),
              })
              .where(eq(mediaAssetsSchema.url, item.url));
          }
        }
      }

      return rows;
    });

    if (deleted.length === 0) {
      throw new ApplicationException(
        `Product with id '${id.getValue()}' not found.`,
        ApplicationExceptionCode.NOT_FOUND,
      );
    }

    if (this.cacheService) {
      try {
        await this.cacheService.del(`product:id:${deleted[0].id}`);
        if (deleted[0].sku) {
          await this.cacheService.del(`product:sku:${deleted[0].sku}`);
        }
        if (deleted[0].variants && Array.isArray(deleted[0].variants)) {
          for (const variant of deleted[0].variants) {
            if (variant?.sku) {
              await this.cacheService.del(`product:sku:${variant.sku}`);
            }
          }
        }
        await this.cacheService.delPattern('product:list:*');
        await this.cacheService.delPattern('category:*');
      } catch {
        // Fail-open: cache eviction errors must not fail database transaction
      }
    }
  }

  // --- Mappers ---

  public static toPersistence(product: Product): ProductInsertRow {
    return {
      id: product.id.getValue(),
      title: product.title,
      description: product.description,
      media: product.media.map((m) => ({ ...m })),
      tags: [...product.tags],
      status: product.status,
      categoryId: product.categoryId ?? null,
      category: product.category ? { ...product.category } : null,
      unitPriceAmount: product.unitPrice.toCents(),
      unitPriceCurrency: product.unitPrice.getCurrency(),
      basePriceAmount: product.basePrice ? product.basePrice.toCents() : null,
      basePriceCurrency: product.basePrice
        ? product.basePrice.getCurrency()
        : null,
      compareAtPriceAmount: product.compareAtPrice
        ? product.compareAtPrice.toCents()
        : null,
      compareAtPriceCurrency: product.compareAtPrice
        ? product.compareAtPrice.getCurrency()
        : null,
      sku: product.sku.getValue(),
      inventoryQuantity: product.inventoryQuantity,
      trackQuantity: product.trackQuantity,
      variants: product.variants.map((v): ProductVariantPersistence => ({
        id: v.id,
        name: v.name,
        type: v.type,
        color: v.color,
        options: v.options,
        sku: v.sku ? v.sku.getValue() : undefined,
        priceAmount: v.unitPrice ? v.unitPrice.toCents() : undefined,
        priceCurrency: v.unitPrice ? v.unitPrice.getCurrency() : undefined,
        inventoryQuantity: v.inventoryQuantity,
      })),
      version: product.version,
      createdAt: product.createdAt,
      updatedAt: product.updatedAt,
    };
  }

  public static toDomain(row: ProductSelectRow): Product {
    const variants: ProductVariant[] = (row.variants ?? []).map((v) => ({
      id: v.id,
      name: v.name,
      type: v.type,
      color: v.color,
      options: v.options,
      sku: v.sku ? SKU.create(v.sku) : undefined,
      unitPrice:
        v.priceAmount !== undefined && v.priceCurrency
          ? Money.create(v.priceAmount / 100, v.priceCurrency)
          : undefined,
      inventoryQuantity: v.inventoryQuantity,
    }));

    const category: ProductCategory | undefined = row.category
      ? {
          name: row.category.name,
          description: row.category.description,
        }
      : undefined;

    return Product.reconstitute({
      id: new ProductId(row.id),
      title: row.title,
      description: row.description,
      media: (row.media ?? []).map((m): ProductMedia => ({ ...m })),
      tags: row.tags ?? [],
      status: row.status as ProductStatus,
      categoryId: row.categoryId ?? undefined,
      category,
      unitPrice: Money.create(row.unitPriceAmount / 100, row.unitPriceCurrency),
      basePrice:
        row.basePriceAmount !== null && row.basePriceCurrency
          ? Money.create(row.basePriceAmount / 100, row.basePriceCurrency)
          : undefined,
      compareAtPrice:
        row.compareAtPriceAmount !== null && row.compareAtPriceCurrency
          ? Money.create(
              row.compareAtPriceAmount / 100,
              row.compareAtPriceCurrency,
            )
          : undefined,
      sku: SKU.create(row.sku),
      inventoryQuantity: row.inventoryQuantity,
      trackQuantity: row.trackQuantity,
      variants,
      version: row.version,
      createdAt: new Date(row.createdAt),
      updatedAt: new Date(row.updatedAt),
    });
  }
}
