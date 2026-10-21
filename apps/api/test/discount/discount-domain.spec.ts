import { describe, expect, it } from 'vitest';
import { Discount } from '../../src/discount/domain/entities/discount.entity.js';
import { DiscountCode } from '../../src/discount/domain/value-objects/discount-code.vo.js';
import { DiscountValue } from '../../src/discount/domain/value-objects/discount-value.vo.js';
import { DiscountScopeVO } from '../../src/discount/domain/value-objects/discount-scope.vo.js';
import { DiscountDomainException } from '../../src/discount/domain/exceptions/discount-domain.exception.js';

describe('Discount Domain Aggregate & Value Objects', () => {
  describe('DiscountCode VO', () => {
    it('should normalize code to uppercase and trim whitespace', () => {
      const code = DiscountCode.create('  eid2026_special  ');
      expect(code.value).toBe('EID2026_SPECIAL');
    });

    it('should throw an exception for invalid codes (too short or special symbols)', () => {
      expect(() => DiscountCode.create('A')).toThrow(DiscountDomainException);
      expect(() => DiscountCode.create('INVALID CODE!')).toThrow(
        DiscountDomainException,
      );
    });
  });

  describe('DiscountValue VO', () => {
    it('should correctly calculate percentage discount using basis points', () => {
      // 1000 bps = 10%
      const val = DiscountValue.percentage(1000);
      expect(val.type).toBe('percentage');
      expect(val.basisPoints).toBe(1000);

      // Cart subtotal: 5000 poisha (50 BDT) -> 10% is 500 poisha
      const discount = val.calculateDiscount(5000);
      expect(discount).toBe(500);
    });

    it('should enforce max discount cap on percentage discounts', () => {
      // 2000 bps = 20%
      const val = DiscountValue.percentage(2000);
      // Cart: 10,000 poisha -> 20% would be 2,000 poisha, but cap is 1,000
      const discount = val.calculateDiscount(10000, 1000);
      expect(discount).toBe(1000);
    });

    it('should calculate fixed amount discount capped at cart total', () => {
      const val = DiscountValue.fixedAmount(300); // 300 poisha
      expect(val.calculateDiscount(1000)).toBe(300);
      expect(val.calculateDiscount(200)).toBe(200); // Capped at subtotal
    });

    it('should throw for invalid percentage basis points outside 1-10000', () => {
      expect(() => DiscountValue.percentage(0)).toThrow(
        DiscountDomainException,
      );
      expect(() => DiscountValue.percentage(10001)).toThrow(
        DiscountDomainException,
      );
    });
  });

  describe('DiscountScope VO', () => {
    it('should match all items when scope is all_products', () => {
      const scope = DiscountScopeVO.allProducts();
      expect(scope.isEligible('prod-1', 'cat-1')).toBe(true);
      expect(scope.isEligible('prod-any', null)).toBe(true);
    });

    it('should match only specified products when scope is specific_products', () => {
      const scope = DiscountScopeVO.specificProducts(['prod-1', 'prod-2']);
      expect(scope.isEligible('prod-1')).toBe(true);
      expect(scope.isEligible('prod-2')).toBe(true);
      expect(scope.isEligible('prod-3')).toBe(false);
    });

    it('should match only specified categories when scope is specific_categories', () => {
      const scope = DiscountScopeVO.specificCategories(['cat-summer']);
      expect(scope.isEligible('prod-1', 'cat-summer')).toBe(true);
      expect(scope.isEligible('prod-1', 'cat-winter')).toBe(false);
      expect(scope.isEligible('prod-1', null)).toBe(false);
    });
  });

  describe('Discount Aggregate Lifecycle & Invariants', () => {
    function createTestDiscount(
      targetStatus: 'draft' | 'active' | 'paused' | 'archived' = 'draft',
    ) {
      const discount = Discount.create({
        code: DiscountCode.create('SAVE20'),
        name: 'Save 20 Campaign',
        value: DiscountValue.percentage(2000), // 20%
        scope: DiscountScopeVO.allProducts(),
        minOrderAmount: 1000, // 10 BDT min
        maxUsageLimit: 100,
        maxUsagePerCustomer: 1,
      });

      if (targetStatus === 'active') {
        discount.activate();
      } else if (targetStatus === 'paused') {
        discount.activate();
        discount.pause();
      } else if (targetStatus === 'archived') {
        discount.archive();
      }

      return discount;
    }

    it('should transition through lifecycle: draft -> active -> paused -> active -> archived', () => {
      const discount = createTestDiscount('draft');
      expect(discount.status).toBe('draft');

      discount.activate();
      expect(discount.status).toBe('active');

      discount.pause();
      expect(discount.status).toBe('paused');

      discount.activate();
      expect(discount.status).toBe('active');

      discount.archive();
      expect(discount.status).toBe('archived');

      // Once archived, cannot be activated or modified
      expect(() => discount.activate()).toThrow(DiscountDomainException);
    });

    it('should prevent mutating core financial terms if campaign has been redeemed', () => {
      const discount = createTestDiscount('active');

      // Simulate a redemption having occurred
      discount.incrementUsage();
      expect(discount.currentUsageCount).toBe(1);

      // Attempting to change financial terms (type/value) must throw
      expect(() => {
        discount.update({
          value: DiscountValue.fixedAmount(500),
        });
      }).toThrow(DiscountDomainException);

      // Changing non-financial terms (e.g. description, maxUsageLimit) is allowed
      expect(() => {
        discount.update({
          description: 'Updated campaign description',
          maxUsageLimit: 200,
        });
      }).not.toThrow();
      expect(discount.description).toBe('Updated campaign description');
      expect(discount.maxUsageLimit).toBe(200);
    });

    it('should check validity and eligibility accurately', () => {
      const discount = createTestDiscount('active');

      // Valid now check
      expect(discount.isValidNow().isValid).toBe(true);

      // Can redeem check: fails if subtotal is below minimum
      const checkUnderMin = discount.canRedeem(0, 500);
      expect(checkUnderMin.canRedeem).toBe(false);

      // Can redeem check: fails if customer exceeded per-customer limit
      const checkOverCustomerLimit = discount.canRedeem(1, 2000);
      expect(checkOverCustomerLimit.canRedeem).toBe(false);

      // Can redeem check: passes when subtotal >= min and usage < cap
      const checkValid = discount.canRedeem(0, 2000);
      expect(checkValid.canRedeem).toBe(true);
    });
  });
});
