import { ICommand } from '@nestjs/cqrs';
import { ProductStatus } from '../../../domain/entities/product.entity.js';

export interface CreateProductMediaInput {
  url: string;
  altText?: string;
  isThumbnail?: boolean;
}

export interface CreateProductCategoryInput {
  name: string;
  description?: string;
}

export interface CreateProductVariantInput {
  id?: string;
  name?: string;
  type?: string;
  color?: string;
  options?: Record<string, string>;
  sku?: string;
  unitPrice?: number;
  inventoryQuantity?: number;
}

export class CreateProductCommand implements ICommand {
  constructor(
    public readonly title: string,
    public readonly unitPrice: number,
    public readonly sku: string,
    public readonly currency: string = 'USD',
    public readonly description: string = '',
    public readonly basePrice?: number,
    public readonly compareAtPrice?: number,
    public readonly inventoryQuantity: number = 0,
    public readonly trackQuantity: boolean = true,
    public readonly status: ProductStatus = ProductStatus.DRAFT,
    public readonly media: CreateProductMediaInput[] = [],
    public readonly tags: string[] = [],
    public readonly categoryId?: string,
    public readonly category?: CreateProductCategoryInput,
    public readonly variants: CreateProductVariantInput[] = [],
  ) {}

  // Convenience aliases for backward compatibility
  get name(): string {
    return this.title;
  }

  get price(): number {
    return this.unitPrice;
  }

  get stock(): number {
    return this.inventoryQuantity;
  }
}
