import { UniqueId } from '../../../shared/domain/value-objects/unique-id.vo.js';

export class PaymentId extends UniqueId {
  static generate(): PaymentId {
    return new PaymentId(crypto.randomUUID());
  }

  static fromString(id: string): PaymentId {
    return new PaymentId(id);
  }
}

