import { AggregateRoot } from '../../../shared/domain/aggregate-root.js';
import { DomainException } from '../../../shared/domain/exceptions/domain.exception.js';
import { Money } from '../../../shared/domain/value-objects/money.vo.js';
import { ProductId } from '../value-objects/product-id.vo.js';
import { SKU } from '../value-objects/sku.vo.js';

export enum ProductStatus {
  ACTIVE = 'active',
  DRAFT = 'draft',
}

export interface ProductMedia {
  url: string;
  altText?: string;
  isThumbnail?: boolean;
}

export interface ProductCategory {
  name: string;
  description?: string;
}

export interface ProductVariant {
  id: string;
  name?: string;
  type?: string; // e.g. "size", "material"
  color?: string; // e.g. "red", "black"
  options?: Record<string, string>; // e.g. { size: 'XL', material: 'Cotton' }
  sku?: SKU;
  unitPrice?: Money;
  inventoryQuantity?: number;
}

export interface ProductProps {
  id: ProductId;
  title: string;
  description: string;
  media: ProductMedia[];
  tags: string[];
  status: ProductStatus;
  category?: ProductCategory;
  unitPrice: Money;
  basePrice?: Money;
  compareAtPrice?: Money;
  sku: SKU;
  inventoryQuantity: number;
  trackQuantity: boolean;
  variants: ProductVariant[];
  version: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateProductInput {
  id?: ProductId;
  title: string;
  description?: string;
  media?: ProductMedia[];
  tags?: string[];
  status?: ProductStatus;
  category?: ProductCategory;
  unitPrice: Money;
  basePrice?: Money;
  compareAtPrice?: Money;
  sku: SKU | string;
  inventoryQuantity?: number;
  trackQuantity?: boolean;
  variants?: ProductVariant[];
}

export class Product extends AggregateRoot {
  private _id: ProductId;
  private _title: string;
  private _description: string;
  private _media: ProductMedia[];
  private _tags: string[];
  private _status: ProductStatus;
  private _category?: ProductCategory;
  private _unitPrice: Money;
  private _basePrice?: Money;
  private _compareAtPrice?: Money;
  private _sku: SKU;
  private _inventoryQuantity: number;
  private _trackQuantity: boolean;
  private _variants: ProductVariant[];
  private _version: number;
  private _createdAt: Date;
  private _updatedAt: Date;

  private constructor(props: ProductProps) {
    super();
    this._id = props.id;
    this._title = props.title;
    this._description = props.description;
    this._media = props.media;
    this._tags = props.tags;
    this._status = props.status;
    this._category = props.category;
    this._unitPrice = props.unitPrice;
    this._basePrice = props.basePrice;
    this._compareAtPrice = props.compareAtPrice;
    this._sku = props.sku;
    this._inventoryQuantity = props.inventoryQuantity;
    this._trackQuantity = props.trackQuantity;
    this._variants = props.variants;
    this._version = props.version;
    this._createdAt = props.createdAt;
    this._updatedAt = props.updatedAt;
  }

  // Factory method to create a new Product
  static create(input: CreateProductInput): Product {
    Product.validateTitle(input.title);

    const trackQuantity = input.trackQuantity ?? true;
    const inventoryQuantity = input.inventoryQuantity ?? 0;
    Product.validateInventory(inventoryQuantity, trackQuantity);

    Product.validatePricing(
      input.unitPrice,
      input.compareAtPrice,
      input.basePrice,
    );

    const skuVo =
      typeof input.sku === 'string' ? SKU.create(input.sku) : input.sku;
    const now = new Date();

    return new Product({
      id: input.id ?? new ProductId(),
      title: input.title.trim(),
      description: input.description ?? '',
      media: input.media ?? [],
      tags: input.tags ?? [],
      status: input.status ?? ProductStatus.DRAFT,
      category: input.category,
      unitPrice: input.unitPrice,
      basePrice: input.basePrice,
      compareAtPrice: input.compareAtPrice,
      sku: skuVo,
      inventoryQuantity,
      trackQuantity,
      variants: input.variants ?? [],
      version: 1,
      createdAt: now,
      updatedAt: now,
    });
  }

  // Reconstitute from persistence (database)
  static reconstitute(props: ProductProps): Product {
    return new Product(props);
  }

  // --- Getters ---
  get id(): ProductId {
    return this._id;
  }

  get title(): string {
    return this._title;
  }

  get description(): string {
    return this._description;
  }

  get media(): ReadonlyArray<ProductMedia> {
    return this._media;
  }

  get tags(): ReadonlyArray<string> {
    return this._tags;
  }

  get status(): ProductStatus {
    return this._status;
  }

  get category(): ProductCategory | undefined {
    return this._category;
  }

  get unitPrice(): Money {
    return this._unitPrice;
  }

  get basePrice(): Money | undefined {
    return this._basePrice;
  }

  get compareAtPrice(): Money | undefined {
    return this._compareAtPrice;
  }

  get sku(): SKU {
    return this._sku;
  }

  get inventoryQuantity(): number {
    return this._inventoryQuantity;
  }

  get trackQuantity(): boolean {
    return this._trackQuantity;
  }

  get variants(): ReadonlyArray<ProductVariant> {
    return this._variants;
  }

  get version(): number {
    return this._version;
  }

  get createdAt(): Date {
    return this._createdAt;
  }

  get updatedAt(): Date {
    return this._updatedAt;
  }

  incrementVersion(): void {
    this._version += 1;
  }

  // --- Business Logic / Domain Methods ---

  publish(): void {
    if (this._status === ProductStatus.ACTIVE) return;
    this._status = ProductStatus.ACTIVE;
    this.touch();
  }

  draft(): void {
    if (this._status === ProductStatus.DRAFT) return;
    this._status = ProductStatus.DRAFT;
    this.touch();
  }

  updateGeneralInfo(title: string, description: string): void {
    Product.validateTitle(title);
    this._title = title.trim();
    this._description = description;
    this.touch();
  }

  updatePricing(
    unitPrice: Money,
    basePrice?: Money,
    compareAtPrice?: Money,
  ): void {
    Product.validatePricing(unitPrice, compareAtPrice, basePrice);
    this._unitPrice = unitPrice;
    this._basePrice = basePrice;
    this._compareAtPrice = compareAtPrice;
    this.touch();
  }

  updateInventory(quantity: number, trackQuantity?: boolean): void {
    const isTracking =
      trackQuantity !== undefined ? trackQuantity : this._trackQuantity;
    Product.validateInventory(quantity, isTracking);
    this._inventoryQuantity = quantity;
    if (trackQuantity !== undefined) {
      this._trackQuantity = trackQuantity;
    }
    this.touch();
  }

  adjustInventory(delta: number): void {
    const newQuantity = this._inventoryQuantity + delta;
    Product.validateInventory(newQuantity, this._trackQuantity);
    this._inventoryQuantity = newQuantity;
    this.touch();
  }

  updateCategory(category: ProductCategory | undefined): void {
    this._category = category;
    this.touch();
  }

  addMedia(item: ProductMedia): void {
    this._media.push(item);
    this.touch();
  }

  removeMedia(url: string): void {
    this._media = this._media.filter((m) => m.url !== url);
    this.touch();
  }

  addTag(tag: string): void {
    const trimmed = tag.trim().toLowerCase();
    if (trimmed && !this._tags.includes(trimmed)) {
      this._tags.push(trimmed);
      this.touch();
    }
  }

  removeTag(tag: string): void {
    const trimmed = tag.trim().toLowerCase();
    this._tags = this._tags.filter((t) => t !== trimmed);
    this.touch();
  }

  addVariant(variant: ProductVariant): void {
    const exists = this._variants.some((v) => v.id === variant.id);
    if (exists) {
      throw new DomainException(
        `Variant with id '${variant.id}' already exists.`,
      );
    }
    this._variants.push(variant);
    this.touch();
  }

  removeVariant(variantId: string): void {
    this._variants = this._variants.filter((v) => v.id !== variantId);
    this.touch();
  }

  hasDiscount(): boolean {
    if (!this._compareAtPrice) return false;
    return this._compareAtPrice.isGreaterThan(this._unitPrice);
  }

  // --- Validations ---

  private touch(): void {
    this._updatedAt = new Date();
  }

  private static validateTitle(title: string): void {
    if (!title || title.trim().length < 2) {
      throw new DomainException(
        'Product title must be at least 2 characters long.',
      );
    }
  }

  private static validateInventory(
    quantity: number,
    trackQuantity: boolean,
  ): void {
    if (trackQuantity && quantity < 0) {
      throw new DomainException(
        'Inventory quantity cannot be negative when tracking is enabled.',
      );
    }
  }

  private static validatePricing(
    unitPrice: Money,
    compareAtPrice?: Money,
    basePrice?: Money,
  ): void {
    if (!unitPrice) {
      throw new DomainException('Product unit price is required.');
    }

    if (
      compareAtPrice &&
      compareAtPrice.getCurrency() !== unitPrice.getCurrency()
    ) {
      throw new DomainException(
        'Compare-at price and unit price must share the same currency.',
      );
    }

    if (basePrice && basePrice.getCurrency() !== unitPrice.getCurrency()) {
      throw new DomainException(
        'Base price and unit price must share the same currency.',
      );
    }
  }
}
