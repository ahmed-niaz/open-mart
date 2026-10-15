import { Product } from '../../domain/entities/product.entity.js';
import { ProductId } from '../../domain/value-objects/product-id.vo.js';
import { SKU } from '../../domain/value-objects/sku.vo.js';

export const PRODUCT_REPOSITORY = Symbol('PRODUCT_REPOSITORY');

export interface ProductFilters {
  status?: string;
  minPrice?: number;
  maxPrice?: number;
  category?: string;
  tag?: string;
}

export interface ProductRepositoryPort {
  save(product: Product): Promise<void>;
  findById(id: ProductId): Promise<Product | null>;
  findBySku(sku: SKU): Promise<Product | null>;
  findByTitle(title: string): Promise<Product | null>;
  findAll(filters: ProductFilters): Promise<Product[]>;
  delete(id: ProductId): Promise<void>;
}
