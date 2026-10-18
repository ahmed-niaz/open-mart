import { Inject, Injectable } from '@nestjs/common';
import { and, eq, gte, lte, SQL } from 'drizzle-orm';
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

@Injectable()
export class DrizzleProductRepository implements ProductRepositoryPort {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

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

  // 6. DELETE (Permanently removes record from database)
  async delete(id: ProductId): Promise<void> {
    const deleted = await this.db
      .delete(productsSchema)
      .where(eq(productsSchema.id, id.getValue()))
      .returning({ id: productsSchema.id });

    if (deleted.length === 0) {
      throw new ApplicationException(
        `Product with id '${id.getValue()}' not found.`,
        ApplicationExceptionCode.NOT_FOUND,
      );
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
