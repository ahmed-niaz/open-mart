import { AggregateRoot } from '../../../shared/domain/aggregate-root.js';
import { DiscountDomainException } from '../exceptions/discount-domain.exception.js';
import { DiscountId } from '../value-objects/discount-id.vo.js';
import { DiscountCode } from '../value-objects/discount-code.vo.js';
import { DiscountValue } from '../value-objects/discount-value.vo.js';
import { DiscountScopeVO } from '../value-objects/discount-scope.vo.js';
import { DiscountCreatedEvent } from '../events/discount-created.event.js';
import { DiscountStatusChangedEvent } from '../events/discount-status-changed.event.js';
import type {
  CustomerEligibilityValue,
  DiscountStatusValue,
} from '../../../shared/infrastructure/database/postgres/schema/discount.schema.js';

export interface CreateDiscountProps {
  id?: DiscountId;
  code: DiscountCode;
  name: string;
  description?: string;
  value: DiscountValue;
  scope: DiscountScopeVO;
  customerEligibility?: CustomerEligibilityValue;
  excludeSaleItems?: boolean;
  minOrderAmount?: number;
  maxDiscountAmount?: number;
  maxUsageLimit?: number;
  maxUsagePerCustomer?: number;
  startsAt?: Date;
  expiresAt?: Date;
  createdBy?: string;
}

export interface ReconstituteDiscountProps {
  id: DiscountId;
  code: DiscountCode;
  name: string;
  description?: string;
  value: DiscountValue;
  scope: DiscountScopeVO;
  status: DiscountStatusValue;
  customerEligibility: CustomerEligibilityValue;
  excludeSaleItems: boolean;
  minOrderAmount: number;
  maxDiscountAmount?: number;
  maxUsageLimit?: number;
  currentUsageCount: number;
  maxUsagePerCustomer: number;
  startsAt: Date;
  expiresAt?: Date;
  version: number;
  createdBy?: string;
  updatedBy?: string;
  createdAt: Date;
  updatedAt: Date;
}

export class Discount extends AggregateRoot {
  private readonly _id: DiscountId;
  private _code: DiscountCode;
  private _name: string;
  private _description?: string;
  private _value: DiscountValue;
  private _scope: DiscountScopeVO;
  private _status: DiscountStatusValue;
  private _customerEligibility: CustomerEligibilityValue;
  private _excludeSaleItems: boolean;
  private _minOrderAmount: number;
  private _maxDiscountAmount?: number;
  private _maxUsageLimit?: number;
  private _currentUsageCount: number;
  private _maxUsagePerCustomer: number;
  private _startsAt: Date;
  private _expiresAt?: Date;
  private _version: number;
  private _createdBy?: string;
  private _updatedBy?: string;
  private readonly _createdAt: Date;
  private _updatedAt: Date;

  private constructor(props: ReconstituteDiscountProps) {
    super();
    this._id = props.id;
    this._code = props.code;
    this._name = props.name;
    this._description = props.description;
    this._value = props.value;
    this._scope = props.scope;
    this._status = props.status;
    this._customerEligibility = props.customerEligibility;
    this._excludeSaleItems = props.excludeSaleItems;
    this._minOrderAmount = props.minOrderAmount;
    this._maxDiscountAmount = props.maxDiscountAmount;
    this._maxUsageLimit = props.maxUsageLimit;
    this._currentUsageCount = props.currentUsageCount;
    this._maxUsagePerCustomer = props.maxUsagePerCustomer;
    this._startsAt = props.startsAt;
    this._expiresAt = props.expiresAt;
    this._version = props.version;
    this._createdBy = props.createdBy;
    this._updatedBy = props.updatedBy;
    this._createdAt = props.createdAt;
    this._updatedAt = props.updatedAt;
  }

  static create(props: CreateDiscountProps): Discount {
    if (!props.name || props.name.trim().length === 0) {
      throw new DiscountDomainException('Discount name cannot be empty.');
    }

    const startsAt = props.startsAt || new Date();
    if (props.expiresAt && props.expiresAt <= startsAt) {
      throw new DiscountDomainException(
        'Discount expiration date must be after the start date.',
      );
    }

    if (props.minOrderAmount !== undefined && props.minOrderAmount < 0) {
      throw new DiscountDomainException(
        'Minimum order amount cannot be negative.',
      );
    }

    if (
      props.maxUsagePerCustomer !== undefined &&
      props.maxUsagePerCustomer < 1
    ) {
      throw new DiscountDomainException(
        'Max usage per customer must be at least 1.',
      );
    }

    if (props.maxUsageLimit !== undefined && props.maxUsageLimit < 1) {
      throw new DiscountDomainException('Max usage limit must be at least 1.');
    }

    const discount = new Discount({
      id: props.id || DiscountId.create(),
      code: props.code,
      name: props.name.trim(),
      description: props.description?.trim(),
      value: props.value,
      scope: props.scope,
      status: 'draft',
      customerEligibility: props.customerEligibility || 'all',
      excludeSaleItems: props.excludeSaleItems ?? false,
      minOrderAmount: props.minOrderAmount ?? 0,
      maxDiscountAmount: props.maxDiscountAmount,
      maxUsageLimit: props.maxUsageLimit,
      currentUsageCount: 0,
      maxUsagePerCustomer: props.maxUsagePerCustomer ?? 1,
      startsAt,
      expiresAt: props.expiresAt,
      version: 1,
      createdBy: props.createdBy,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    discount.apply(
      new DiscountCreatedEvent(
        discount.id.value,
        discount.code.value,
        discount.value.type,
        props.createdBy,
      ),
    );

    return discount;
  }

  static reconstitute(props: ReconstituteDiscountProps): Discount {
    return new Discount(props);
  }

  // Getters
  get id(): DiscountId {
    return this._id;
  }
  get code(): DiscountCode {
    return this._code;
  }
  get name(): string {
    return this._name;
  }
  get description(): string | undefined {
    return this._description;
  }
  get value(): DiscountValue {
    return this._value;
  }
  get scope(): DiscountScopeVO {
    return this._scope;
  }
  get status(): DiscountStatusValue {
    return this._status;
  }
  get customerEligibility(): CustomerEligibilityValue {
    return this._customerEligibility;
  }
  get excludeSaleItems(): boolean {
    return this._excludeSaleItems;
  }
  get minOrderAmount(): number {
    return this._minOrderAmount;
  }
  get maxDiscountAmount(): number | undefined {
    return this._maxDiscountAmount;
  }
  get maxUsageLimit(): number | undefined {
    return this._maxUsageLimit;
  }
  get currentUsageCount(): number {
    return this._currentUsageCount;
  }
  get maxUsagePerCustomer(): number {
    return this._maxUsagePerCustomer;
  }
  get startsAt(): Date {
    return this._startsAt;
  }
  get expiresAt(): Date | undefined {
    return this._expiresAt;
  }
  get version(): number {
    return this._version;
  }
  get createdBy(): string | undefined {
    return this._createdBy;
  }
  get updatedBy(): string | undefined {
    return this._updatedBy;
  }
  get createdAt(): Date {
    return this._createdAt;
  }
  get updatedAt(): Date {
    return this._updatedAt;
  }

  // Lifecycle State Machine
  activate(updatedBy?: string): void {
    if (this._status === 'archived') {
      throw new DiscountDomainException(
        'Archived discounts cannot be reactivated.',
      );
    }
    if (this._status === 'active') {
      return;
    }
    const previous = this._status;
    this._status = 'active';
    this._updatedBy = updatedBy;

    this.apply(
      new DiscountStatusChangedEvent(
        this._id.value,
        this._code.value,
        previous,
        'active',
        updatedBy,
      ),
    );
  }

  pause(updatedBy?: string): void {
    if (this._status !== 'active') {
      throw new DiscountDomainException(
        `Cannot pause discount from status '${this._status}'. Only active discounts can be paused.`,
      );
    }
    this._status = 'paused';
    this._updatedBy = updatedBy;

    this.apply(
      new DiscountStatusChangedEvent(
        this._id.value,
        this._code.value,
        'active',
        'paused',
        updatedBy,
      ),
    );
  }

  archive(updatedBy?: string): void {
    if (this._status === 'archived') {
      return;
    }
    const previous = this._status;
    this._status = 'archived';
    this._updatedBy = updatedBy;

    this.apply(
      new DiscountStatusChangedEvent(
        this._id.value,
        this._code.value,
        previous,
        'archived',
        updatedBy,
      ),
    );
  }

  // Safe Update enforcing immutability of live redeemed discounts
  update(props: {
    name?: string;
    description?: string;
    code?: DiscountCode;
    value?: DiscountValue;
    scope?: DiscountScopeVO;
    customerEligibility?: CustomerEligibilityValue;
    excludeSaleItems?: boolean;
    minOrderAmount?: number;
    maxDiscountAmount?: number;
    maxUsageLimit?: number;
    maxUsagePerCustomer?: number;
    startsAt?: Date;
    expiresAt?: Date;
    updatedBy?: string;
  }): void {
    if (this._status === 'archived') {
      throw new DiscountDomainException('Cannot edit an archived discount.');
    }

    // IMMUTABILITY GUARD: If redemptions exist, core financial parameters are locked
    if (this._currentUsageCount > 0) {
      if (props.code && !props.code.equals(this._code)) {
        throw new DiscountDomainException(
          'Cannot change discount code on an already-redeemed discount.',
        );
      }
      if (
        props.value &&
        (props.value.type !== this._value.type ||
          props.value.rawValue !== this._value.rawValue)
      ) {
        throw new DiscountDomainException(
          'Cannot alter discount type or value on an already-redeemed discount.',
        );
      }
      if (props.scope && props.scope.scope !== this._scope.scope) {
        throw new DiscountDomainException(
          'Cannot alter discount scope on an already-redeemed discount.',
        );
      }
    }

    if (props.name) {
      this._name = props.name.trim();
    }
    if (props.description !== undefined) {
      this._description = props.description.trim();
    }
    if (props.code && this._currentUsageCount === 0) {
      this._code = props.code;
    }
    if (props.value && this._currentUsageCount === 0) {
      this._value = props.value;
    }
    if (props.scope && this._currentUsageCount === 0) {
      this._scope = props.scope;
    }
    if (props.customerEligibility) {
      this._customerEligibility = props.customerEligibility;
    }
    if (props.excludeSaleItems !== undefined) {
      this._excludeSaleItems = props.excludeSaleItems;
    }
    if (props.minOrderAmount !== undefined) {
      if (props.minOrderAmount < 0) {
        throw new DiscountDomainException(
          'Minimum order amount cannot be negative.',
        );
      }
      this._minOrderAmount = props.minOrderAmount;
    }
    if (props.maxDiscountAmount !== undefined) {
      this._maxDiscountAmount = props.maxDiscountAmount;
    }
    if (props.maxUsageLimit !== undefined) {
      if (props.maxUsageLimit < this._currentUsageCount) {
        throw new DiscountDomainException(
          `Cannot reduce max usage limit (${props.maxUsageLimit}) below current usage count (${this._currentUsageCount}).`,
        );
      }
      this._maxUsageLimit = props.maxUsageLimit;
    }
    if (props.maxUsagePerCustomer !== undefined) {
      if (props.maxUsagePerCustomer < 1) {
        throw new DiscountDomainException(
          'Max usage per customer must be at least 1.',
        );
      }
      this._maxUsagePerCustomer = props.maxUsagePerCustomer;
    }
    if (props.startsAt) {
      this._startsAt = props.startsAt;
    }
    if (props.expiresAt !== undefined) {
      if (props.expiresAt && props.expiresAt <= this._startsAt) {
        throw new DiscountDomainException(
          'Expiration date must be after the start date.',
        );
      }
      this._expiresAt = props.expiresAt;
    }

    this._updatedBy = props.updatedBy;
  }

  // Temporal & Usage Validation
  isValidNow(atDate: Date = new Date()): { isValid: boolean; reason?: string } {
    if (this._status !== 'active') {
      return {
        isValid: false,
        reason: `Discount is not active (status: ${this._status}).`,
      };
    }
    if (atDate < this._startsAt) {
      return {
        isValid: false,
        reason: 'Discount campaign has not started yet.',
      };
    }
    if (this._expiresAt && atDate > this._expiresAt) {
      return { isValid: false, reason: 'Discount campaign has expired.' };
    }
    if (
      this._maxUsageLimit !== undefined &&
      this._currentUsageCount >= this._maxUsageLimit
    ) {
      return {
        isValid: false,
        reason: 'Discount maximum redemption limit reached.',
      };
    }
    return { isValid: true };
  }

  canRedeem(
    customerUsageCount: number,
    eligibleSubtotal: number,
    atDate: Date = new Date(),
  ): { canRedeem: boolean; reason?: string } {
    const validCheck = this.isValidNow(atDate);
    if (!validCheck.isValid) {
      return { canRedeem: false, reason: validCheck.reason };
    }

    if (eligibleSubtotal < this._minOrderAmount) {
      return {
        canRedeem: false,
        reason: `Order eligible subtotal (${(eligibleSubtotal / 100).toFixed(2)}) is below minimum required spend (${(this._minOrderAmount / 100).toFixed(2)}).`,
      };
    }

    if (customerUsageCount >= this._maxUsagePerCustomer) {
      return {
        canRedeem: false,
        reason:
          'You have reached the maximum redemption limit for this coupon.',
      };
    }

    return { canRedeem: true };
  }

  incrementUsage(): void {
    if (
      this._maxUsageLimit !== undefined &&
      this._currentUsageCount >= this._maxUsageLimit
    ) {
      throw new DiscountDomainException(
        'Cannot increment usage: maximum redemption limit reached.',
      );
    }
    this._currentUsageCount += 1;
  }

  decrementUsage(): void {
    this._currentUsageCount = Math.max(0, this._currentUsageCount - 1);
  }

  incrementVersion(): void {
    this._version += 1;
  }
}
