import { UniqueId } from '../../../shared/domain/value-objects/unique-id.vo.js';

export class OrderItemId extends UniqueId {
  static generate(): OrderItemId {
    return new OrderItemId(crypto.randomUUID());
  }

  static fromString(id: string): OrderItemId {
    return new OrderItemId(id);
  }
}
