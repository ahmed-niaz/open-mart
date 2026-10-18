import type { Customer } from '../../domain/entities/customer.entity.js';

export const CUSTOMER_REPOSITORY = Symbol('CUSTOMER_REPOSITORY');

export interface CustomerRepository {
  save(customer: Customer): Promise<void>;
  findById(id: string): Promise<Customer | null>;
  findByEmail(email: string): Promise<Customer | null>;
  findByGoogleId(googleId: string): Promise<Customer | null>;
  existsByEmail(email: string): Promise<boolean>;
}
