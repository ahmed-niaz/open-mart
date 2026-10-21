import { DiscountDomainException } from '../exceptions/discount-domain.exception.js';
import type { DiscountScopeValue } from '../../../shared/infrastructure/database/postgres/schema/discount.schema.js';

export class DiscountScopeVO {
  private constructor(
    private readonly _scope: DiscountScopeValue,
    private readonly _targetProductIds: ReadonlySet<string>,
    private readonly _targetCategoryIds: ReadonlySet<string>,
  ) {}

  static allProducts(): DiscountScopeVO {
    return new DiscountScopeVO('all_products', new Set(), new Set());
  }

  static specificProducts(productIds: string[]): DiscountScopeVO {
    if (!productIds || productIds.length === 0) {
      throw new DiscountDomainException(
        "Discount with scope 'specific_products' must specify at least one target product ID.",
      );
    }
    return new DiscountScopeVO(
      'specific_products',
      new Set(productIds),
      new Set(),
    );
  }

  static specificCategories(categoryIds: string[]): DiscountScopeVO {
    if (!categoryIds || categoryIds.length === 0) {
      throw new DiscountDomainException(
        "Discount with scope 'specific_categories' must specify at least one target category ID.",
      );
    }
    return new DiscountScopeVO(
      'specific_categories',
      new Set(),
      new Set(categoryIds),
    );
  }

  get scope(): DiscountScopeValue {
    return this._scope;
  }

  get targetProductIds(): string[] {
    return Array.from(this._targetProductIds);
  }

  get targetCategoryIds(): string[] {
    return Array.from(this._targetCategoryIds);
  }

  isEligible(productId: string, categoryId?: string | null): boolean {
    if (this._scope === 'all_products') {
      return true;
    }
    if (this._scope === 'specific_products') {
      return this._targetProductIds.has(productId);
    }
    if (this._scope === 'specific_categories') {
      return categoryId ? this._targetCategoryIds.has(categoryId) : false;
    }
    return false;
  }
}
