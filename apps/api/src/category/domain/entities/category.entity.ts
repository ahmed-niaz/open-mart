import { AggregateRoot } from '../../../shared/domain/aggregate-root.js';
import { DomainException } from '../../../shared/domain/exceptions/domain.exception.js';
import { CategoryId } from '../value-objects/category-id.vo.js';
import { Slug } from '../value-objects/slug.vo.js';

export interface CategoryProps {
  id: CategoryId;
  name: string;
  slug: Slug;
  description: string;
  parentId?: CategoryId | null;
  imageUrl?: string;
  isActive: boolean;
  displayOrder: number;
  version: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateCategoryInput {
  id?: CategoryId;
  name: string;
  slug?: Slug | string;
  description?: string;
  parentId?: CategoryId | null;
  imageUrl?: string;
  isActive?: boolean;
  displayOrder?: number;
}

export interface UpdateCategoryDetailsInput {
  name?: string;
  slug?: Slug | string;
  description?: string;
  imageUrl?: string;
  displayOrder?: number;
}

export class Category extends AggregateRoot {
  private _id: CategoryId;
  private _name: string;
  private _slug: Slug;
  private _description: string;
  private _parentId: CategoryId | null;
  private _imageUrl?: string;
  private _isActive: boolean;
  private _displayOrder: number;
  private _version: number;
  private _createdAt: Date;
  private _updatedAt: Date;

  private constructor(props: CategoryProps) {
    super();
    this._id = props.id;
    this._name = props.name;
    this._slug = props.slug;
    this._description = props.description;
    this._parentId = props.parentId ?? null;
    this._imageUrl = props.imageUrl;
    this._isActive = props.isActive;
    this._displayOrder = props.displayOrder;
    this._version = props.version;
    this._createdAt = props.createdAt;
    this._updatedAt = props.updatedAt;
  }

  public static create(input: CreateCategoryInput): Category {
    const id = input.id ?? new CategoryId();
    const name = Category.validateName(input.name);
    const slug =
      input.slug instanceof Slug
        ? input.slug
        : Slug.create(input.slug ?? input.name);

    let parentId: CategoryId | null = null;
    if (input.parentId) {
      if (input.parentId.equals(id)) {
        throw new DomainException('A category cannot be its own parent.');
      }
      parentId = input.parentId;
    }

    const displayOrder = Category.validateDisplayOrder(input.displayOrder ?? 0);

    return new Category({
      id,
      name,
      slug,
      description: input.description?.trim() ?? '',
      parentId,
      imageUrl: input.imageUrl?.trim() || undefined,
      isActive: input.isActive ?? true,
      displayOrder,
      version: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }

  public static reconstitute(props: CategoryProps): Category {
    return new Category(props);
  }

  public updateDetails(input: UpdateCategoryDetailsInput): void {
    let changed = false;

    if (input.name !== undefined) {
      const validName = Category.validateName(input.name);
      if (this._name !== validName) {
        this._name = validName;
        changed = true;
      }
    }

    if (input.slug !== undefined) {
      const validSlug =
        input.slug instanceof Slug ? input.slug : Slug.create(input.slug);
      if (!this._slug.equals(validSlug)) {
        this._slug = validSlug;
        changed = true;
      }
    }

    if (input.description !== undefined) {
      const desc = input.description.trim();
      if (this._description !== desc) {
        this._description = desc;
        changed = true;
      }
    }

    if (input.imageUrl !== undefined) {
      const img = input.imageUrl.trim() || undefined;
      if (this._imageUrl !== img) {
        this._imageUrl = img;
        changed = true;
      }
    }

    if (input.displayOrder !== undefined) {
      const order = Category.validateDisplayOrder(input.displayOrder);
      if (this._displayOrder !== order) {
        this._displayOrder = order;
        changed = true;
      }
    }

    if (changed) {
      this._updatedAt = new Date();
    }
  }

  public changeParent(newParentId: CategoryId | null): void {
    if (newParentId && newParentId.equals(this._id)) {
      throw new DomainException('A category cannot be its own parent.');
    }

    const currentParentIdValue = this._parentId?.getValue() ?? null;
    const newParentIdValue = newParentId?.getValue() ?? null;

    if (currentParentIdValue !== newParentIdValue) {
      this._parentId = newParentId;
      this._updatedAt = new Date();
    }
  }

  public activate(): void {
    if (!this._isActive) {
      this._isActive = true;
      this._updatedAt = new Date();
    }
  }

  public deactivate(): void {
    if (this._isActive) {
      this._isActive = false;
      this._updatedAt = new Date();
    }
  }

  public incrementVersion(): void {
    this._version += 1;
  }

  // --- Invariant validation helpers ---

  private static validateName(name: string): string {
    if (!name || typeof name !== 'string') {
      throw new DomainException('Category name cannot be empty.');
    }
    const trimmed = name.trim();
    if (trimmed.length < 2) {
      throw new DomainException(
        'Category name must be at least 2 characters long.',
      );
    }
    if (trimmed.length > 150) {
      throw new DomainException('Category name cannot exceed 150 characters.');
    }
    return trimmed;
  }

  private static validateDisplayOrder(order: number): number {
    if (!Number.isInteger(order) || order < 0) {
      throw new DomainException(
        'Category display order must be an integer greater than or equal to 0.',
      );
    }
    return order;
  }

  // --- Getters ---

  get id(): CategoryId {
    return this._id;
  }

  get name(): string {
    return this._name;
  }

  get slug(): Slug {
    return this._slug;
  }

  get description(): string {
    return this._description;
  }

  get parentId(): CategoryId | null {
    return this._parentId;
  }

  get imageUrl(): string | undefined {
    return this._imageUrl;
  }

  get isActive(): boolean {
    return this._isActive;
  }

  get displayOrder(): number {
    return this._displayOrder;
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
