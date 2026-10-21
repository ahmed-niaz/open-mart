import { Cart } from '../../domain/entities/cart.entity.js';
import { CartId } from '../../domain/value-objects/cart-id.vo.js';

export const CART_REPOSITORY = Symbol('CART_REPOSITORY');

export interface CartRepositoryPort {
  save(cart: Cart): Promise<void>;
  findById(id: CartId): Promise<Cart | null>;
  findActiveByCustomerId(customerId: string): Promise<Cart | null>;
  findActiveByGuestId(guestId: string): Promise<Cart | null>;
  findExpiredActiveCarts(threshold: Date, limit: number): Promise<Cart[]>;
}
