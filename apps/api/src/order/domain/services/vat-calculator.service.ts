import { Money } from '../../../shared/domain/value-objects/money.vo.js';

export class VatCalculator {
  // Bangladesh standard retail VAT rate (15%)
  static readonly DEFAULT_VAT_RATE = 0.15;

  /**
   * Backs out VAT from VAT-inclusive Maximum Retail Price (MRP):
   * Tax = round(Taxable * rate / (1 + rate))
   */
  static calculateBackedOutVat(
    taxableAmount: Money,
    vatRate = VatCalculator.DEFAULT_VAT_RATE,
  ): Money {
    const cents = taxableAmount.toCents();
    if (cents <= 0) {
      return Money.zero(taxableAmount.getCurrency());
    }

    const vatCents = Math.round((cents * vatRate) / (1 + vatRate));
    return Money.fromCents(vatCents, taxableAmount.getCurrency());
  }
}
