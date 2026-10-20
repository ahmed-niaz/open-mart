import type { Order } from '../../domain/entities/order.entity.js';
import type { OrderId } from '../../domain/value-objects/order-id.vo.js';

export const ORDER_REPOSITORY = Symbol('ORDER_REPOSITORY');

export interface OrderRepositoryPort {
  findById(id: OrderId): Promise<Order | null>;
  save(order: Order): Promise<void>;
}
