import { Quantity } from './quantity.vo.js';
import { DomainException } from '../../../shared/domain/exceptions/domain.exception.js';

export class StockLevel {
  private readonly quantityOnHand: Quantity;
  private readonly reservedQuantity: Quantity;

  constructor(quantityOnHand: Quantity, reservedQuantity: Quantity) {
    if (reservedQuantity.getValue() > quantityOnHand.getValue()) {
      throw new DomainException(
        `Reserved quantity (${reservedQuantity.getValue()}) cannot exceed quantity on hand (${quantityOnHand.getValue()})`,
      );
    }

    this.quantityOnHand = quantityOnHand;
    this.reservedQuantity = reservedQuantity;
  }

  static create(onHand: number, reserved: number = 0): StockLevel {
    return new StockLevel(Quantity.create(onHand), Quantity.create(reserved));
  }

  getOnHand(): Quantity {
    return this.quantityOnHand;
  }

  getReserved(): Quantity {
    return this.reservedQuantity;
  }

  getAvailable(): Quantity {
    return Quantity.create(
      this.quantityOnHand.getValue() - this.reservedQuantity.getValue(),
    );
  }

  canFulfill(requested: Quantity | number): boolean {
    const qty =
      typeof requested === 'number' ? requested : requested.getValue();
    return this.getAvailable().getValue() >= qty;
  }

  isOutOfStock(): boolean {
    return this.getAvailable().isZero();
  }

  isLowStock(threshold: number): boolean {
    const available = this.getAvailable().getValue();
    return available > 0 && available <= threshold;
  }

  withOnHand(newOnHand: Quantity): StockLevel {
    return new StockLevel(newOnHand, this.reservedQuantity);
  }

  withReserved(newReserved: Quantity): StockLevel {
    return new StockLevel(this.quantityOnHand, newReserved);
  }
}
