import { Product } from '../../domain/entities/product.entity.js';
import type { ProductSelectRow } from '../../../../shared/infrastructure/database/postgres/schema/product.schema.js';

export class ProductVariantResponseDto {
  id: string;
  name?: string;
  type?: string;
  color?: string;
  options?: Record<string, string>;
  sku?: string;
  unitPrice?: number;
  inventoryQuantity?: number;
}

export class ProductResponseDto {
  id: string;
  title: string;
  description: string;
  media: Array<{ url: string; altText?: string; isThumbnail?: boolean }>;
  tags: string[];
  status: string;
  category?: { name: string; description?: string };
  unitPrice: number;
  currency: string;
  basePrice?: number;
  compareAtPrice?: number;
  sku: string;
  inventoryQuantity: number;
  trackQuantity: boolean;
  variants: ProductVariantResponseDto[];
  version: number;
  createdAt: string;
  updatedAt: string;

  static fromPersistence(row: ProductSelectRow): ProductResponseDto {
    const dto = new ProductResponseDto();
    dto.id = row.id;
    dto.title = row.title;
    dto.description = row.description;
    dto.media =
      (row.media as Array<{
        url: string;
        altText?: string;
        isThumbnail?: boolean;
      }>) ?? [];
    dto.tags = (row.tags as string[]) ?? [];
    dto.status = row.status;
    dto.category = row.category ? { ...row.category } : undefined;
    dto.unitPrice = row.unitPriceAmount;
    dto.currency = row.unitPriceCurrency;
    dto.basePrice = row.basePriceAmount ?? undefined;
    dto.compareAtPrice = row.compareAtPriceAmount ?? undefined;
    dto.sku = row.sku;
    dto.inventoryQuantity = row.inventoryQuantity;
    dto.trackQuantity = row.trackQuantity;
    dto.variants = (row.variants ?? []).map((v) => ({
      id: v.id,
      name: v.name,
      type: v.type,
      color: v.color,
      options: v.options,
      sku: v.sku,
      unitPrice: v.priceAmount,
      inventoryQuantity: v.inventoryQuantity,
    }));
    dto.version = row.version;
    dto.createdAt =
      row.createdAt instanceof Date
        ? row.createdAt.toISOString()
        : String(row.createdAt);
    dto.updatedAt =
      row.updatedAt instanceof Date
        ? row.updatedAt.toISOString()
        : String(row.updatedAt);
    return dto;
  }

  static fromDomain(product: Product): ProductResponseDto {
    const dto = new ProductResponseDto();
    dto.id = product.id.getValue();
    dto.title = product.title;
    dto.description = product.description;
    dto.media = product.media.map((m) => ({ ...m }));
    dto.tags = [...product.tags];
    dto.status = product.status;
    dto.category = product.category ? { ...product.category } : undefined;
    dto.unitPrice = product.unitPrice.getAmount();
    dto.currency = product.unitPrice.getCurrency();
    dto.basePrice = product.basePrice
      ? product.basePrice.getAmount()
      : undefined;
    dto.compareAtPrice = product.compareAtPrice
      ? product.compareAtPrice.getAmount()
      : undefined;
    dto.sku = product.sku.getValue();
    dto.inventoryQuantity = product.inventoryQuantity;
    dto.trackQuantity = product.trackQuantity;
    dto.variants = product.variants.map((v) => ({
      id: v.id,
      name: v.name,
      type: v.type,
      color: v.color,
      options: v.options,
      sku: v.sku?.getValue(),
      unitPrice: v.unitPrice?.getAmount(),
      inventoryQuantity: v.inventoryQuantity,
    }));
    dto.version = product.version;
    dto.createdAt = product.createdAt.toISOString();
    dto.updatedAt = product.updatedAt.toISOString();
    return dto;
  }
}
