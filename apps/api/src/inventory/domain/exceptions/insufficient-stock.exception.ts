import { DomainException } from '../../../shared/domain/exceptions/domain.exception.js';

export class InsufficientStockException extends DomainException {
  constructor(
    public readonly sku: string,
    public readonly requested: number,
    public readonly available: number,
  ) {
    super(
      `Insufficient stock for SKU '${sku}'. Requested: ${requested}, Available: ${available}`,
    );
  }
}
