import { Reservation } from '../../domain/entities/reservation.entity.js';

export const RESERVATION_REPOSITORY = Symbol('RESERVATION_REPOSITORY');

export interface ReservationRepositoryPort {
  findByOrderId(orderId: string): Promise<Reservation[]>;
  save(reservation: Reservation): Promise<void>;
  commitForOrder(
    orderId: string,
  ): Promise<Array<{ sku: string; quantity: number; newOnHand: number }>>;
  releaseForOrder(
    orderId: string,
    reason?: string,
  ): Promise<Array<{ sku: string; quantity: number }>>;
  reverseForOrder(
    orderId: string,
    reason?: string,
  ): Promise<Array<{ sku: string; quantity: number; newOnHand: number }>>;
}
