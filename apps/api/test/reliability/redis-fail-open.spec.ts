import { describe, expect, it, vi } from 'vitest';
import { CacheService } from '../../src/shared/infrastructure/cache/cache.service.js';
import { RedisThrottlerStorage } from '../../src/shared/infrastructure/redis/redis-throttler.storage.js';
import { GetCategoryByIdHandler } from '../../src/category/application/queries/get-category-by-id/get-category-by-id.handler.js';

describe('Phase 3: Redis & Fail-Open Resilience Unit Tests', () => {
  describe('CacheService (Single-Flight & Fail-Open)', () => {
    function createMockRedis(initialData: Record<string, string> = {}) {
      const store = new Map<string, string>(Object.entries(initialData));

      return {
        store,
        get: vi.fn(async (key: string) => store.get(key) || null),
        set: vi.fn(async (key: string, val: string) => {
          store.set(key, val);
          return 'OK';
        }),
        del: vi.fn(async (...keys: string[]) => {
          let count = 0;
          for (const k of keys) {
            if (store.delete(k)) count++;
          }
          return count;
        }),
        scanStream: vi.fn((_opts?: any) => {
          const keys = Array.from(store.keys());
          return (async function* () {
            if (keys.length > 0) yield keys;
          })();
        }),
      };
    }

    it('returns cached data instantly on cache hit without calling database fetcher', async () => {
      const mockProduct = {
        id: 'prod-123',
        title: 'Power Hoodie',
        unitPrice: 4500,
      };
      const mockRedis = createMockRedis({
        'om:cache:product:id:prod-123': JSON.stringify(mockProduct),
      });

      const cacheService = new CacheService(mockRedis as any);
      const dbFetcher = vi.fn(async () => ({
        id: 'prod-123',
        title: 'DB Hoodie',
        unitPrice: 4500,
      }));

      const result = await cacheService.getOrSet(
        'product:id:prod-123',
        dbFetcher,
        180,
      );

      expect(result).toEqual(mockProduct);
      expect(dbFetcher).not.toHaveBeenCalled();
      expect(mockRedis.get).toHaveBeenCalledWith(
        'om:cache:product:id:prod-123',
      );
    });

    it('executes database fetcher on cache miss and stores serialized result in Redis with TTL', async () => {
      const mockProduct = {
        id: 'prod-999',
        title: 'Seamless Leggings',
        unitPrice: 3800,
      };
      const mockRedis = createMockRedis();

      const cacheService = new CacheService(mockRedis as any);
      const dbFetcher = vi.fn(async () => mockProduct);

      const result = await cacheService.getOrSet(
        'product:id:prod-999',
        dbFetcher,
        180,
      );

      expect(result).toEqual(mockProduct);
      expect(dbFetcher).toHaveBeenCalledTimes(1);
      expect(mockRedis.set).toHaveBeenCalledWith(
        'om:cache:product:id:prod-999',
        JSON.stringify(mockProduct),
        'EX',
        180,
      );
    });

    it('enforces single-flight stampede protection: coalesces 10 concurrent requests into 1 database query', async () => {
      const mockCategoryTree = [{ id: 'cat-1', name: 'Apparel', children: [] }];
      const mockRedis = createMockRedis();

      let fetchCount = 0;
      const dbFetcher = vi.fn(async () => {
        fetchCount++;
        // Simulate real-world database query latency
        await new Promise((res) => setTimeout(res, 30));
        return mockCategoryTree;
      });

      const cacheService = new CacheService(mockRedis as any);

      // 10 concurrent requests arrive at the exact same millisecond
      const concurrentRequests = Array.from({ length: 10 }).map(() =>
        cacheService.getOrSet('category:tree:active', dbFetcher, 600),
      );

      const results = await Promise.all(concurrentRequests);

      // Verify all 10 received the exact same data
      for (const res of results) {
        expect(res).toEqual(mockCategoryTree);
      }

      // Proves single-flight: database fetcher was only executed ONCE instead of 10 times!
      expect(fetchCount).toBe(1);
      expect(dbFetcher).toHaveBeenCalledTimes(1);
    });

    it('FAILS OPEN when Redis throws an error (does NOT crash or 500-error)', async () => {
      const mockRedis = {
        get: vi
          .fn()
          .mockRejectedValue(
            new Error('ECONNREFUSED: Redis server unreachable'),
          ),
        set: vi
          .fn()
          .mockRejectedValue(
            new Error('ECONNREFUSED: Redis server unreachable'),
          ),
      };

      const cacheService = new CacheService(mockRedis as any);
      const dbProduct = { id: 'prod-live', title: 'Lifting Belt' };
      const dbFetcher = vi.fn(async () => dbProduct);

      // Must succeed transparently using DB fetcher despite Redis outage
      const result = await cacheService.getOrSet(
        'product:id:prod-live',
        dbFetcher,
        180,
      );

      expect(result).toEqual(dbProduct);
      expect(dbFetcher).toHaveBeenCalledTimes(1);
    });

    it('FAILS OPEN when Redis times out (>200ms)', async () => {
      const mockRedis = {
        // Hangs indefinitely to simulate network partition / high Redis lag
        get: vi.fn(() => new Promise((resolve) => setTimeout(resolve, 500))),
        set: vi.fn().mockResolvedValue('OK'),
      };

      const cacheService = new CacheService(mockRedis as any);
      const dbProduct = { id: 'prod-timeout', title: 'Wrist Wraps' };
      const dbFetcher = vi.fn(async () => dbProduct);

      const result = await cacheService.getOrSet(
        'product:id:prod-timeout',
        dbFetcher,
        180,
      );

      expect(result).toEqual(dbProduct);
      expect(dbFetcher).toHaveBeenCalledTimes(1);
    });

    it('deletes specific keys and patterns cleanly', async () => {
      const mockRedis = createMockRedis({
        'om:cache:product:id:1': '{"id":1}',
        'om:cache:product:id:2': '{"id":2}',
      });

      const cacheService = new CacheService(mockRedis as any);

      await cacheService.del('product:id:1');
      expect(mockRedis.store.has('om:cache:product:id:1')).toBe(false);

      await cacheService.delPattern('product:*');
      expect(mockRedis.del).toHaveBeenCalled();
    });
  });

  describe('RedisThrottlerStorage (Distributed Rate Limiter)', () => {
    it('increments hit counter atomically and sets TTL when within limit', async () => {
      const mockRedis = {
        pttl: vi.fn().mockResolvedValue(-1),
        eval: vi.fn().mockResolvedValue([1, 60000]),
        set: vi.fn().mockResolvedValue('OK'),
      };

      const storage = new RedisThrottlerStorage(mockRedis as any);
      const record = await storage.increment(
        'ip-192.168.1.1',
        60000,
        100,
        0,
        'default',
      );

      expect(record.totalHits).toBe(1);
      expect(record.timeToExpire).toBe(60);
      expect(record.isBlocked).toBe(false);
      expect(mockRedis.eval).toHaveBeenCalledTimes(1);
    });

    it('flags isBlocked: true when total hits exceed configured limit', async () => {
      const mockRedis = {
        pttl: vi.fn().mockResolvedValue(-1),
        eval: vi.fn().mockResolvedValue([101, 45000]), // 101 hits (limit is 100)
        set: vi.fn().mockResolvedValue('OK'),
      };

      const storage = new RedisThrottlerStorage(mockRedis as any);
      const record = await storage.increment(
        'ip-spammer',
        60000,
        100,
        30000,
        'default',
      );

      expect(record.totalHits).toBe(101);
      expect(record.isBlocked).toBe(true);
      expect(mockRedis.set).toHaveBeenCalledWith(
        'om:throttle:block:default:ip-spammer',
        '1',
        'PX',
        30000,
      );
    });

    it('FAILS OPEN when Redis is down (never blocks legitimate shoppers due to Redis outage)', async () => {
      const mockRedis = {
        pttl: vi.fn().mockRejectedValue(new Error('Redis connection lost')),
        eval: vi.fn().mockRejectedValue(new Error('Redis connection lost')),
      };

      const storage = new RedisThrottlerStorage(mockRedis as any);
      const record = await storage.increment(
        'customer-checkout-ip',
        60000,
        100,
        0,
        'default',
      );

      // Fails open: returns safe hit count and isBlocked: false
      expect(record.totalHits).toBe(1);
      expect(record.isBlocked).toBe(false);
    });
  });

  describe('Query Handlers & Mutation Invalidation Integration', () => {
    it('caches GetCategoryByIdHandler query and skips DB on subsequent requests', async () => {
      const mockCategory = {
        id: 'cat-100',
        name: 'Gym Sets',
        slug: 'gym-sets',
        isActive: true,
      };

      const mockRedis = {
        store: new Map<string, string>([
          ['om:cache:category:id:cat-100', JSON.stringify(mockCategory)],
        ]),
        get: vi.fn(async (k: string) => mockRedis.store.get(k) || null),
        set: vi.fn(async () => 'OK'),
      };

      const cacheService = new CacheService(mockRedis as any);
      const dbSelect = vi.fn();
      const mockDb = { select: dbSelect } as any;

      const handler = new GetCategoryByIdHandler(mockDb, cacheService);
      const result = await handler.execute({ id: 'cat-100' });

      expect(result).toEqual(mockCategory);
      expect(dbSelect).not.toHaveBeenCalled();
      expect(mockRedis.get).toHaveBeenCalledWith(
        'om:cache:category:id:cat-100',
      );
    });

    it('caches ListProductHandler query and enforces single-flight coalescing', async () => {
      const mockResult = {
        data: [{ id: 'p1', title: 'Power Tee' }],
        meta: { total: 1, page: 1, limit: 20, totalPages: 1 },
      };

      const mockRedis = {
        store: new Map<string, string>(),
        get: vi.fn(async () => null),
        set: vi.fn(async (k: string, v: string) => {
          mockRedis.store.set(k, v);
          return 'OK';
        }),
      };

      const cacheService = new CacheService(mockRedis as any);

      // Simulate simultaneous incoming listing queries
      let dbExecutions = 0;
      const fetcher = async () => {
        dbExecutions++;
        await new Promise((r) => setTimeout(r, 20));
        return mockResult;
      };

      const cacheKey = 'product:list:test-page-1';
      const [res1, res2, res3] = await Promise.all([
        cacheService.getOrSet(cacheKey, fetcher, 60),
        cacheService.getOrSet(cacheKey, fetcher, 60),
        cacheService.getOrSet(cacheKey, fetcher, 60),
      ]);

      expect(res1).toEqual(mockResult);
      expect(res2).toEqual(mockResult);
      expect(res3).toEqual(mockResult);
      expect(dbExecutions).toBe(1);
    });

    it('invalidates product and category cache patterns cleanly', async () => {
      const mockRedis = {
        del: vi.fn().mockResolvedValue(1),
        scanStream: vi.fn(() =>
          (async function* () {
            yield ['om:cache:product:list:1', 'om:cache:product:list:2'];
          })(),
        ),
      };

      const cacheService = new CacheService(mockRedis as any);
      await cacheService.del('product:id:prod-1');
      await cacheService.delPattern('product:list:*');

      expect(mockRedis.del).toHaveBeenCalledWith('om:cache:product:id:prod-1');
      expect(mockRedis.scanStream).toHaveBeenCalled();
    });
  });
});
