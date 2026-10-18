import { Inject, Injectable } from '@nestjs/common';
import { and, eq } from 'drizzle-orm';
import { CategoryVerificationPort } from '../../application/ports/category-verification.port.js';
import { DRIZZLE } from '../../../shared/infrastructure/database/postgres/drizzle.provider.js';
import type { DrizzleDB } from '../../../shared/infrastructure/database/postgres/drizzle.provider.js';
import { categoriesSchema } from '../../../shared/infrastructure/database/postgres/schema/category.schema.js';

@Injectable()
export class CategoryVerificationAdapter implements CategoryVerificationPort {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  async isCategoryValid(categoryId: string): Promise<boolean> {
    const rows = await this.db
      .select({ id: categoriesSchema.id })
      .from(categoriesSchema)
      .where(
        and(
          eq(categoriesSchema.id, categoryId),
          eq(categoriesSchema.isActive, true),
        ),
      )
      .limit(1);

    return rows.length > 0;
  }
}
