import type { CustomerSelectRow } from '../../../shared/infrastructure/database/postgres/schema/customer.schema.js';
import type { Customer } from '../../domain/entities/customer.entity.js';

export class CustomerResponseDto {
  id!: string;
  email!: string;
  firstName!: string;
  lastName!: string;
  fullName!: string;
  phoneNumber!: string | null;
  avatarUrl!: string | null;
  hasPassword!: boolean;
  isGoogleLinked!: boolean;
  isActive!: boolean;
  isEmailVerified!: boolean;
  lastLoginAt!: string | null;
  createdAt!: string;
  updatedAt!: string;

  static fromPersistence(row: CustomerSelectRow): CustomerResponseDto {
    const dto = new CustomerResponseDto();
    dto.id = row.id;
    dto.email = row.email;
    dto.firstName = row.firstName;
    dto.lastName = row.lastName;
    dto.fullName = [row.firstName, row.lastName]
      .filter(Boolean)
      .join(' ')
      .trim();
    dto.phoneNumber = row.phoneNumber;
    dto.avatarUrl = row.avatarUrl;
    dto.hasPassword = !!row.passwordHash;
    dto.isGoogleLinked = !!row.googleId;
    dto.isActive = row.isActive;
    dto.isEmailVerified = row.isEmailVerified;
    dto.lastLoginAt = row.lastLoginAt ? row.lastLoginAt.toISOString() : null;
    dto.createdAt = row.createdAt.toISOString();
    dto.updatedAt = row.updatedAt.toISOString();
    return dto;
  }

  static fromDomain(customer: Customer): CustomerResponseDto {
    const dto = new CustomerResponseDto();
    dto.id = customer.id.getValue();
    dto.email = customer.email.value;
    dto.firstName = customer.firstName;
    dto.lastName = customer.lastName;
    dto.fullName = customer.fullName;
    dto.phoneNumber = customer.phoneNumber;
    dto.avatarUrl = customer.avatarUrl;
    dto.hasPassword = !!customer.passwordHash;
    dto.isGoogleLinked = !!customer.googleId;
    dto.isActive = customer.isActive;
    dto.isEmailVerified = customer.isEmailVerified;
    dto.lastLoginAt = customer.lastLoginAt
      ? customer.lastLoginAt.toISOString()
      : null;
    dto.createdAt = customer.createdAt.toISOString();
    dto.updatedAt = customer.updatedAt.toISOString();
    return dto;
  }
}
