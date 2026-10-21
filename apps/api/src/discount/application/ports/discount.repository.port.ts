import type { Discount } from '../../domain/entities/discount.entity.js';

export const DISCOUNT_REPOSITORY_PORT = Symbol('DISCOUNT_REPOSITORY_PORT');

export interface DiscountRepositoryPort {
  findById(id: string): Promise<Discount | null>;
  findByCode(code: string): Promise<Discount | null>;
  save(discount: Discount): Promise<void>;
  atomicIncrementUsage(
    discountId: string,
    currentVersion: number,
    maxUsageLimit?: number,
  ): Promise<boolean>;
  atomicDecrementUsage(discountId: string): Promise<void>;
}
