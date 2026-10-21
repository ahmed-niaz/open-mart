export interface LineItemForAllocation {
  productId: string;
  lineTotal: number; // in poisha
}

export interface AllocatedLine {
  productId: string;
  allocatedAmount: number; // in poisha
}

export class DiscountAllocation {
  /**
   * Distributes totalDiscount across eligible line items using the Largest-Remainder Method (Hare-Niemeyer).
   * Guarantees:
   * 1. Sum of all allocated line amounts strictly equals totalDiscount (zero rounding drift).
   * 2. No line item receives an allocation greater than its lineTotal.
   */
  static allocateProportionally(
    lines: LineItemForAllocation[],
    totalDiscount: number,
  ): AllocatedLine[] {
    if (lines.length === 0 || totalDiscount <= 0) {
      return lines.map((l) => ({ productId: l.productId, allocatedAmount: 0 }));
    }

    const totalEligible = lines.reduce((sum, l) => sum + l.lineTotal, 0);
    if (totalEligible <= 0) {
      return lines.map((l) => ({ productId: l.productId, allocatedAmount: 0 }));
    }

    // Cap total discount at total eligible subtotal
    const effectiveDiscount = Math.min(totalDiscount, totalEligible);

    // Step 1: Compute base allocation and fractional remainders
    const lineShares = lines.map((line, index) => {
      const exactShare = (line.lineTotal / totalEligible) * effectiveDiscount;
      const baseShare = Math.floor(exactShare);
      const fraction = exactShare - baseShare;

      return {
        index,
        productId: line.productId,
        lineTotal: line.lineTotal,
        baseShare,
        fraction,
        allocated: baseShare,
      };
    });

    // Step 2: Calculate unallocated poisha remainder
    const totalAllocatedBase = lineShares.reduce(
      (sum, l) => sum + l.baseShare,
      0,
    );
    let remainder = effectiveDiscount - totalAllocatedBase;

    // Step 3: Sort by largest remainder fraction descending
    lineShares.sort((a, b) => b.fraction - a.fraction);

    // Step 4: Distribute 1 poisha to top lines until remainder is 0
    for (const line of lineShares) {
      if (remainder <= 0) break;
      if (line.allocated < line.lineTotal) {
        line.allocated += 1;
        remainder -= 1;
      }
    }

    // Restore original ordering
    lineShares.sort((a, b) => a.index - b.index);

    return lineShares.map((l) => ({
      productId: l.productId,
      allocatedAmount: l.allocated,
    }));
  }
}
