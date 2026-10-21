import { describe, expect, it } from 'vitest';
import { DiscountAllocation } from '../../src/discount/domain/value-objects/discount-allocation.vo.js';

describe('DiscountAllocation Value Object (Largest-Remainder Method)', () => {
  it('should return zero allocations when total discount is zero', () => {
    const lines = [
      { productId: 'prod-1', lineTotal: 1000 },
      { productId: 'prod-2', lineTotal: 2000 },
    ];

    const result = DiscountAllocation.allocateProportionally(lines, 0);

    expect(result).toEqual([
      { productId: 'prod-1', allocatedAmount: 0 },
      { productId: 'prod-2', allocatedAmount: 0 },
    ]);
  });

  it('should cap allocations at line totals if discount equals or exceeds subtotal', () => {
    const lines = [
      { productId: 'prod-1', lineTotal: 1500 },
      { productId: 'prod-2', lineTotal: 2500 },
    ];

    const result = DiscountAllocation.allocateProportionally(lines, 5000);

    expect(result).toEqual([
      { productId: 'prod-1', allocatedAmount: 1500 },
      { productId: 'prod-2', allocatedAmount: 2500 },
    ]);
    const totalAllocated = result.reduce((s, r) => s + r.allocatedAmount, 0);
    expect(totalAllocated).toBe(4000); // capped at subtotal
  });

  it('should divide discounts proportionally with zero rounding drift on fractional poisha', () => {
    // 3 items with equal prices: 100, 100, 100 (subtotal 300)
    // Discount: 100 poisha (33.333... per item)
    // Largest-Remainder Method should give: 34, 33, 33 = 100 poisha exactly!
    const lines = [
      { productId: 'prod-1', lineTotal: 100 },
      { productId: 'prod-2', lineTotal: 100 },
      { productId: 'prod-3', lineTotal: 100 },
    ];

    const result = DiscountAllocation.allocateProportionally(lines, 100);

    const totalAllocated = result.reduce((s, r) => s + r.allocatedAmount, 0);
    expect(totalAllocated).toBe(100);

    const amounts = result.map((r) => r.allocatedAmount);
    expect(amounts.sort((a, b) => a - b)).toEqual([33, 33, 34]);
  });

  it('should handle complex proportions and guarantee total allocated equals discount exactly', () => {
    // Lines: 733, 1429, 2838. Subtotal: 5000. Discount: 750 (15%)
    const lines = [
      { productId: 'p1', lineTotal: 733 },
      { productId: 'p2', lineTotal: 1429 },
      { productId: 'p3', lineTotal: 2838 },
    ];

    const discount = 750;
    const result = DiscountAllocation.allocateProportionally(lines, discount);

    const totalAllocated = result.reduce((s, r) => s + r.allocatedAmount, 0);
    expect(totalAllocated).toBe(discount);

    // Each allocated amount must not exceed the line item total
    for (let i = 0; i < lines.length; i++) {
      expect(result[i].allocatedAmount).toBeLessThanOrEqual(lines[i].lineTotal);
      expect(result[i].allocatedAmount).toBeGreaterThan(0);
    }
  });

  it('should return an empty array when given no line items', () => {
    const result = DiscountAllocation.allocateProportionally([], 500);
    expect(result).toEqual([]);
  });
});
