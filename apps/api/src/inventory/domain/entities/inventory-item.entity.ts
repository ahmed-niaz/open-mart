import { AggregateRoot } from '../../../shared/domain/aggregate-root.js';
import { DomainException } from '../../../shared/domain/exceptions/domain.exception.js';
import { Sku } from '../value-objects/sku.vo.js';
import { StockLevel } from '../value-objects/stock-level.vo.js';
import { LowStockDetectedEvent } from '../events/low-stock-detected.event.js';

export interface InventoryItemProps {
  id: string;
  productId: string;
  sku: Sku;
  stockLevel: StockLevel;
  lowStockThreshold: number;
  isActive: boolean;
  version: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateInventoryItemProps {
  id?: string;
  productId: string;
  sku: string;
  initialOnHand?: number;
  lowStockThreshold?: number;
  isActive?: boolean;
}

export class InventoryItem extends AggregateRoot {
  private readonly _id: string;
  private readonly _productId: string;
  private readonly _sku: Sku;
  private _stockLevel: StockLevel;
  private _lowStockThreshold: number;
  private _isActive: boolean;
  private _version: number;
  private readonly _createdAt: Date;
  private _updatedAt: Date;

  private constructor(props: InventoryItemProps) {
    super();
    this._id = props.id;
    this._productId = props.productId;
    this._sku = props.sku;
    this._stockLevel = props.stockLevel;
    this._lowStockThreshold = props.lowStockThreshold;
    this._isActive = props.isActive;
    this._version = props.version;
    this._createdAt = props.createdAt;
    this._updatedAt = props.updatedAt;
  }

  static create(props: CreateInventoryItemProps): InventoryItem {
    const sku = Sku.create(props.sku);
    const initialOnHand = props.initialOnHand ?? 0;
    if (initialOnHand < 0) {
      throw new DomainException('Initial on-hand quantity cannot be negative');
    }

    const threshold = props.lowStockThreshold ?? 5;
    if (threshold < 0) {
      throw new DomainException('Low stock threshold cannot be negative');
    }

    const now = new Date();
    return new InventoryItem({
      id: props.id ?? crypto.randomUUID(),
      productId: props.productId,
      sku,
      stockLevel: StockLevel.create(initialOnHand, 0),
      lowStockThreshold: threshold,
      isActive: props.isActive ?? true,
      version: 1,
      createdAt: now,
      updatedAt: now,
    });
  }

  static reconstitute(props: InventoryItemProps): InventoryItem {
    return new InventoryItem(props);
  }

  // ---------------------------------------------------------------------------
  // Settings & OCC
  // ---------------------------------------------------------------------------

  updateSettings(lowStockThreshold: number, isActive: boolean): void {
    if (lowStockThreshold < 0) {
      throw new DomainException('Low stock threshold cannot be negative');
    }
    this._lowStockThreshold = lowStockThreshold;
    this._isActive = isActive;
    this.touch();
  }

  incrementVersion(): void {
    this._version += 1;
    this._updatedAt = new Date();
  }

  private touch(): void {
    this._updatedAt = new Date();
  }

  // ---------------------------------------------------------------------------
  // Threshold Crossing Check
  // ---------------------------------------------------------------------------

  checkLowStockThresholdCrossing(previousAvailable: number): void {
    const currentAvailable = this._stockLevel.getAvailable().getValue();
    if (
      previousAvailable > this._lowStockThreshold &&
      currentAvailable <= this._lowStockThreshold &&
      currentAvailable > 0
    ) {
      this.apply(
        new LowStockDetectedEvent(
          this._sku.getValue(),
          currentAvailable,
          this._lowStockThreshold,
          new Date(),
        ),
      );
    }
  }

  // ---------------------------------------------------------------------------
  // Getters
  // ---------------------------------------------------------------------------

  get id(): string {
    return this._id;
  }

  get productId(): string {
    return this._productId;
  }

  get sku(): Sku {
    return this._sku;
  }

  get stockLevel(): StockLevel {
    return this._stockLevel;
  }

  get lowStockThreshold(): number {
    return this._lowStockThreshold;
  }

  get isActive(): boolean {
    return this._isActive;
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
}
