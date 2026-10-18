import { ICommand } from '@nestjs/cqrs';
import {
  ProductCategory,
  ProductMedia,
  ProductStatus,
} from '../../../domain/entities/product.entity.js';

export interface UpdateProductVariantInput {
  id?: string;
  name?: string;
  type?: string;
  color?: string;
  options?: Record<string, string>;
  sku?: string;
  unitPrice?: number;
  inventoryQuantity?: number;
}

export class UpdateProductCommand implements ICommand {
  constructor(
    public readonly id: string,
    public readonly title?: string,
    public readonly unitPrice?: number,
    public readonly currency?: string,
    public readonly description?: string,
    public readonly basePrice?: number,
    public readonly compareAtPrice?: number,
    public readonly inventoryQuantity?: number,
    public readonly trackQuantity?: boolean,
    public readonly status?: ProductStatus,
    public readonly media?: ProductMedia[],
    public readonly tags?: string[],
    public readonly categoryId?: string | null,
    public readonly category?: ProductCategory,
    public readonly variants?: UpdateProductVariantInput[],
  ) {}
}
