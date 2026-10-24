import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';
import { inArray, sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as dotenv from 'dotenv';
import { resolve } from 'node:path';
import { randomUUID } from 'node:crypto';

import { DrizzleDiscountRepository } from '../../src/discount/infrastructure/adapters/drizzle-discount.repository.js';
import { DrizzleDiscountRedemptionRepository } from '../../src/discount/infrastructure/adapters/drizzle-discount-redemption.repository.js';
import { DiscountCalculationAdapter } from '../../src/discount/infrastructure/adapters/discount-calculation.adapter.js';
import { ChangeDiscountStatusCommandHandler } from '../../src/discount/application/commands/change-discount-status/change-discount-status.handler.js';
import { ChangeDiscountStatusCommand } from '../../src/discount/application/commands/change-discount-status/change-discount-status.command.js';
import { Discount } from '../../src/discount/domain/entities/discount.entity.js';
import { DiscountCode } from '../../src/discount/domain/value-objects/discount-code.vo.js';
import { DiscountValue } from '../../src/discount/domain/value-objects/discount-value.vo.js';
import { DiscountScopeVO } from '../../src/discount/domain/value-objects/discount-scope.vo.js';
import { ApplicationException } from '../../src/shared/domain/exceptions/application.exception.js';
import {
  discountsSchema,
  discountRedemptionsSchema,
} from '../../src/shared/infrastructure/database/postgres/schema/discount.schema.js';
import { ordersSchema } from '../../src/shared/infrastructure/database/postgres/schema/order.schema.js';

dotenv.config({ path: resolve(process.cwd(), '.env') });
dotenv.config({ path: resolve(process.cwd(), 'apps/api/.env') });

const dbUrl =
  process.env.POSTGRES_DB_URL ||
  'postgresql://postgres:postgres@localhost:5432/openmart';

describe('Discount & Promotion Module PostgreSQL Integration Tests', () => {
  let client: postgres.Sql | null = null;
  let db: any;
  let discountRepo: DrizzleDiscountRepository;
  let redemptionRepo: DrizzleDiscountRedemptionRepository;
  let calculationAdapter: DiscountCalculationAdapter;
  let isDbAvailable = false;

  const testCodesToClean: string[] = [];
  const testOrderIdsToClean: string[] = [];

  async function createTestOrder(orderId: string) {
    testOrderIdsToClean.push(orderId);
    await db.insert(ordersSchema).values({
      id: orderId,
      status: 'pending',
      totalAmount: 10000,
      totalCurrency: 'BDT',
      recipientName: 'Test Recipient',
      recipientPhone: '01700000000',
      shippingDivision: 'Dhaka',
      shippingDistrict: 'Dhaka',
      shippingCity: 'Dhaka',
      shippingArea: 'Gulshan',
      shippingAddressLine: 'House 1, Road 2',
    });
  }

  beforeAll(async () => {
    try {
      const testClient = postgres(dbUrl, {
        max: 2,
        connect_timeout: 2,
        idle_timeout: 2,
      });
      await testClient`SELECT 1`;
      client = testClient;
      db = drizzle(client);

      discountRepo = new DrizzleDiscountRepository(db);
      redemptionRepo = new DrizzleDiscountRedemptionRepository(db);
      calculationAdapter = new DiscountCalculationAdapter(
        db,
        discountRepo,
        redemptionRepo,
      );
      isDbAvailable = true;
    } catch {
      console.warn(
        `PostgreSQL is not reachable at ${dbUrl}. Skipping discount integration tests.`,
      );
      isDbAvailable = false;
    }
  });

  beforeEach((ctx) => {
    if (!isDbAvailable) {
      ctx.skip();
    }
  });

  afterAll(async () => {
    if (!isDbAvailable) return;
    try {
      if (testOrderIdsToClean.length > 0) {
        await db
          .delete(discountRedemptionsSchema)
          .where(
            inArray(discountRedemptionsSchema.orderId, testOrderIdsToClean),
          );
        await db
          .delete(ordersSchema)
          .where(inArray(ordersSchema.id, testOrderIdsToClean));
      }
      if (testCodesToClean.length > 0) {
        await db
          .delete(discountsSchema)
          .where(inArray(discountsSchema.code, testCodesToClean));
      }
    } finally {
      if (client) {
        await client.end();
      }
    }
  });

  it('should persist and retrieve a discount aggregate in PostgreSQL', async () => {
    const codeStr = `TEST_${Date.now()}`;
    testCodesToClean.push(codeStr);

    const discount = Discount.create({
      code: DiscountCode.create(codeStr),
      name: 'Integration Test Promo',
      value: DiscountValue.percentage(1500), // 15%
      scope: DiscountScopeVO.allProducts(),
      minOrderAmount: 2000,
      maxDiscountAmount: 5000,
      maxUsageLimit: 10,
      maxUsagePerCustomer: 2,
    });
    discount.activate();

    await discountRepo.save(discount);

    const loaded = await discountRepo.findByCode(codeStr);
    expect(loaded).toBeDefined();
    expect(loaded?.code.value).toBe(codeStr);
    expect(loaded?.value.type).toBe('percentage');
    expect(loaded?.value.basisPoints).toBe(1500);
    expect(loaded?.minOrderAmount).toBe(2000);
    expect(loaded?.maxUsageLimit).toBe(10);
    expect(loaded?.maxUsagePerCustomer).toBe(2);
    expect(loaded?.status).toBe('active');
  });

  it('should atomically increment and decrement usage count in PostgreSQL', async () => {
    const codeStr = `ATOM_${Date.now()}`;
    testCodesToClean.push(codeStr);

    const discount = Discount.create({
      code: DiscountCode.create(codeStr),
      name: 'Atomic Cap Test',
      value: DiscountValue.fixedAmount(500),
      scope: DiscountScopeVO.allProducts(),
      maxUsageLimit: 1, // Cap at 1 usage
    });
    discount.activate();

    await discountRepo.save(discount);

    // 1st atomic increment should succeed
    const inc1 = await discountRepo.atomicIncrementUsage(
      discount.id.value,
      discount.version,
      discount.maxUsageLimit,
    );
    expect(inc1).toBe(true);

    const reloaded = await discountRepo.findById(discount.id.value);
    expect(reloaded?.currentUsageCount).toBe(1);

    // 2nd atomic increment must fail because maxUsageLimit is 1
    const inc2 = await discountRepo.atomicIncrementUsage(
      discount.id.value,
      reloaded!.version,
      discount.maxUsageLimit,
    );
    expect(inc2).toBe(false);

    // Atomic decrement (e.g. on order cancellation) should restore capacity
    await discountRepo.atomicDecrementUsage(discount.id.value);

    const afterDecrement = await discountRepo.findById(discount.id.value);
    expect(afterDecrement?.currentUsageCount).toBe(0);
  });

  it('should perform two-phase reservation lifecycle: reserved -> confirmed and reserved -> released', async () => {
    const codeStr = `LIFECYCLE_${Date.now()}`;
    testCodesToClean.push(codeStr);
    const orderId1 = randomUUID();
    const orderId2 = randomUUID();

    await createTestOrder(orderId1);
    await createTestOrder(orderId2);

    const discount = Discount.create({
      code: DiscountCode.create(codeStr),
      name: 'Lifecycle Campaign',
      value: DiscountValue.percentage(1000), // 10%
      scope: DiscountScopeVO.allProducts(),
      maxUsageLimit: 5,
      maxUsagePerCustomer: 2,
    });
    discount.activate();
    await discountRepo.save(discount);

    // 1. Reserve discount for order 1
    await calculationAdapter.reserve(
      discount.id.value,
      orderId1,
      null,
      'cust@openmart.com',
      codeStr,
      500,
    );

    // Verify redemption row is 'reserved'
    const count = await redemptionRepo.countByCustomer(
      discount.id.value,
      'cust@openmart.com',
    );
    expect(count).toBe(1);

    // 2. Confirm order 1
    await calculationAdapter.confirm(orderId1);

    const rawRows1 = await db.execute(sql`
      SELECT status FROM discount_redemptions WHERE order_id = ${orderId1}
    `);
    expect(rawRows1[0].status).toBe('confirmed');

    // 3. Reserve discount for order 2, then release it
    await calculationAdapter.reserve(
      discount.id.value,
      orderId2,
      null,
      'cust@openmart.com',
      codeStr,
      500,
    );

    // Total active/reserved for customer is now 2 (at the limit)
    const count2 = await redemptionRepo.countByCustomer(
      discount.id.value,
      'cust@openmart.com',
    );
    expect(count2).toBe(2);

    // Release order 2 (e.g. order cancelled)
    await calculationAdapter.release(orderId2);

    const rawRows2 = await db.execute(sql`
      SELECT status FROM discount_redemptions WHERE order_id = ${orderId2}
    `);
    expect(rawRows2[0].status).toBe('released');

    // Released redemptions do not count toward customer cap
    const countAfterRelease = await redemptionRepo.countByCustomer(
      discount.id.value,
      'cust@openmart.com',
    );
    expect(countAfterRelease).toBe(1);
  });

  it('should enforce pg_advisory_xact_lock and block customer who exceeded per-customer limit', async () => {
    const codeStr = `LIMIT_${Date.now()}`;
    testCodesToClean.push(codeStr);
    const orderId1 = randomUUID();
    const orderId2 = randomUUID();

    await createTestOrder(orderId1);
    await createTestOrder(orderId2);

    const discount = Discount.create({
      code: DiscountCode.create(codeStr),
      name: 'Single-Use Per Customer',
      value: DiscountValue.fixedAmount(100),
      scope: DiscountScopeVO.allProducts(),
      maxUsagePerCustomer: 1, // Only 1 redemption allowed
    });
    discount.activate();
    await discountRepo.save(discount);

    // 1st checkout passes
    await calculationAdapter.reserve(
      discount.id.value,
      orderId1,
      null,
      'buyer-1@customer.com',
      codeStr,
      100,
    );

    // 2nd concurrent/subsequent checkout for buyer-1 must be rejected with CONFLICT
    await expect(
      calculationAdapter.reserve(
        discount.id.value,
        orderId2,
        null,
        'buyer-1@customer.com',
        codeStr,
        100,
      ),
    ).rejects.toThrow(ApplicationException);
  });

  it('should enforce RBAC guard: manager cannot archive discounts without DISCOUNTS_DELETE permission', async () => {
    const codeStr = `RBAC_${Date.now()}`;
    testCodesToClean.push(codeStr);

    const discount = Discount.create({
      code: DiscountCode.create(codeStr),
      name: 'RBAC Test',
      value: DiscountValue.percentage(1000),
      scope: DiscountScopeVO.allProducts(),
    });
    discount.activate();
    await discountRepo.save(discount);

    const mockPublisher = {
      mergeObjectContext: (obj: any) => {
        obj.commit = vi.fn();
        return obj;
      },
    } as any;

    const handler = new ChangeDiscountStatusCommandHandler(
      discountRepo,
      db,
      mockPublisher,
    );

    // Manager role lacks DISCOUNTS_DELETE -> must throw Forbidden
    await expect(
      handler.execute(
        new ChangeDiscountStatusCommand(
          discount.id.value,
          'archived',
          undefined,
          'manager',
        ),
      ),
    ).rejects.toThrow('Only administrators can archive discounts');

    // Admin role has DISCOUNTS_DELETE -> succeeds
    await expect(
      handler.execute(
        new ChangeDiscountStatusCommand(
          discount.id.value,
          'archived',
          undefined,
          'admin',
        ),
      ),
    ).resolves.toBeUndefined();

    const archivedDiscount = await discountRepo.findById(discount.id.value);
    expect(archivedDiscount?.status).toBe('archived');
  });
});
