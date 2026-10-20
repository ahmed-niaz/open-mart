import { UniqueId } from '../../../shared/domain/value-objects/unique-id.vo.js';

export class OrderId extends UniqueId {
  static generate(): OrderId {
    return new OrderId(crypto.randomUUID());
  }

  static fromString(id: string): OrderId {
    return new OrderId(id);
  }
}
