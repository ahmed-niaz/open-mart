import { Inject, Injectable } from '@nestjs/common';
import { and, eq } from 'drizzle-orm';

import { CustomerRepository } from '../../application/ports/customer.repository.js';
import { Customer } from '../../domain/entities/customer.entity.js';
import { CustomerId } from '../../domain/value-objects/customer-id.vo.js';
import { Email } from '../../domain/value-objects/email.vo.js';
import { PasswordHash } from '../../domain/value-objects/password-hash.vo.js';
import {
  DRIZZLE,
  type DrizzleDB,
} from '../../../shared/infrastructure/database/postgres/drizzle.provider.js';
import {
  customersSchema,
  type CustomerSelectRow,
} from '../../../shared/infrastructure/database/postgres/schema/customer.schema.js';
import {
  ApplicationException,
  ApplicationExceptionCode,
} from '../../../shared/domain/exceptions/application.exception.js';

@Injectable()
export class DrizzleCustomerRepository implements CustomerRepository {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  async save(customer: Customer): Promise<void> {
    const row = this.toPersistence(customer);

    const existing = await this.db
      .select({ id: customersSchema.id })
      .from(customersSchema)
      .where(eq(customersSchema.id, customer.id.getValue()))
      .limit(1);

    if (existing.length === 0) {
      // 1. Insert brand new customer
      await this.db.insert(customersSchema).values(row);
      return;
    }

    // 2. OCC Update: enforce atomic version matching
    const currentVersion = customer.version;
    const nextVersion = currentVersion + 1;

    const updated = await this.db
      .update(customersSchema)
      .set({
        email: row.email,
        passwordHash: row.passwordHash,
        googleId: row.googleId,
        firstName: row.firstName,
        lastName: row.lastName,
        phoneNumber: row.phoneNumber,
        avatarUrl: row.avatarUrl,
        isActive: row.isActive,
        isEmailVerified: row.isEmailVerified,
        version: nextVersion,
        lastLoginAt: row.lastLoginAt,
        updatedAt: customer.updatedAt,
      })
      .where(
        and(
          eq(customersSchema.id, customer.id.getValue()),
          eq(customersSchema.version, currentVersion),
        ),
      )
      .returning({ id: customersSchema.id });

    if (updated.length === 0) {
      throw new ApplicationException(
        `Optimistic lock failure: Customer '${customer.id.getValue()}' was modified concurrently by another process.`,
        ApplicationExceptionCode.CONFLICT,
      );
    }

    // Bump in-memory aggregate version after successful update
    customer.incrementVersion();
  }

  async findById(id: string): Promise<Customer | null> {
    const rows = await this.db
      .select()
      .from(customersSchema)
      .where(eq(customersSchema.id, id))
      .limit(1);

    const row = rows[0];
    if (!row) return null;
    return this.toDomain(row);
  }

  async findByEmail(email: string): Promise<Customer | null> {
    const normalized = email.trim().toLowerCase();
    const rows = await this.db
      .select()
      .from(customersSchema)
      .where(eq(customersSchema.email, normalized))
      .limit(1);

    const row = rows[0];
    if (!row) return null;
    return this.toDomain(row);
  }

  async findByGoogleId(googleId: string): Promise<Customer | null> {
    const rows = await this.db
      .select()
      .from(customersSchema)
      .where(eq(customersSchema.googleId, googleId.trim()))
      .limit(1);

    const row = rows[0];
    if (!row) return null;
    return this.toDomain(row);
  }

  async existsByEmail(email: string): Promise<boolean> {
    const normalized = email.trim().toLowerCase();
    const rows = await this.db
      .select({ id: customersSchema.id })
      .from(customersSchema)
      .where(eq(customersSchema.email, normalized))
      .limit(1);

    return rows.length > 0;
  }

  private toPersistence(customer: Customer) {
    return {
      id: customer.id.getValue(),
      email: customer.email.value,
      passwordHash: customer.passwordHash ? customer.passwordHash.value : null,
      googleId: customer.googleId,
      firstName: customer.firstName,
      lastName: customer.lastName,
      phoneNumber: customer.phoneNumber,
      avatarUrl: customer.avatarUrl,
      isActive: customer.isActive,
      isEmailVerified: customer.isEmailVerified,
      version: customer.version,
      lastLoginAt: customer.lastLoginAt,
      createdAt: customer.createdAt,
      updatedAt: customer.updatedAt,
    };
  }

  private toDomain(row: CustomerSelectRow): Customer {
    return Customer.reconstitute({
      id: CustomerId.from(row.id),
      email: Email.fromPersisted(row.email),
      passwordHash: row.passwordHash
        ? PasswordHash.create(row.passwordHash)
        : null,
      googleId: row.googleId,
      firstName: row.firstName,
      lastName: row.lastName,
      phoneNumber: row.phoneNumber,
      avatarUrl: row.avatarUrl,
      isActive: row.isActive,
      isEmailVerified: row.isEmailVerified,
      version: row.version,
      lastLoginAt: row.lastLoginAt,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    });
  }
}
