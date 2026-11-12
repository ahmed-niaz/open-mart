import { Inject, Injectable, Logger } from '@nestjs/common';
import { Redis } from 'ioredis';
import { REDIS_CLIENT } from '../redis/redis.constants.js';

export interface CachePort {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T, ttlSeconds?: number): Promise<void>;
  del(key: string | string[]): Promise<void>;
  delPattern(pattern: string): Promise<void>;
  getOrSet<T>(
    key: string,
    fetcher: () => Promise<T>,
    ttlSeconds?: number,
  ): Promise<T>;
}

@Injectable()
export class CacheService implements CachePort {
  private readonly logger = new Logger(CacheService.name);
  private readonly inFlight = new Map<string, Promise<any>>();
  private readonly namespaceEpochs = new Map<string, number>();
  private readonly timeoutMs = 200; // 200ms timeout to ensure low-latency response

  constructor(@Inject(REDIS_CLIENT) private readonly redis: Redis) {}

  private qualifyKey(key: string): string {
    return key.startsWith('om:') ? key : `om:cache:${key}`;
  }

  private getNamespace(key: string): string {
    const clean = key.replace(/^om:cache:/, '');
    const colonIndex = clean.indexOf(':');
    return colonIndex > 0 ? clean.slice(0, colonIndex) : clean;
  }

  private bumpNamespaceEpoch(keyOrPattern: string): void {
    const ns = this.getNamespace(keyOrPattern.replace(/\*+$/, ''));
    if (!ns) return;
    const next = (this.namespaceEpochs.get(ns) ?? 0) + 1;
    this.namespaceEpochs.set(ns, next);
  }

  private getNamespaceEpoch(key: string): number {
    const ns = this.getNamespace(key);
    return this.namespaceEpochs.get(ns) ?? 0;
  }

  private withTimeout<T>(
    promise: Promise<T>,
    ms: number = this.timeoutMs,
  ): Promise<T> {
    let timer: NodeJS.Timeout;
    const timeoutPromise = new Promise<never>((_, reject) => {
      timer = setTimeout(() => {
        reject(new Error(`Redis operation timed out after ${ms}ms`));
      }, ms);
    });

    return Promise.race([promise, timeoutPromise]).finally(() => {
      clearTimeout(timer);
    });
  }

  private isRedisReady(): boolean {
    return !this.redis.status || this.redis.status === 'ready';
  }

  async get<T>(key: string): Promise<T | null> {
    if (!this.isRedisReady()) return null;
    const fullKey = this.qualifyKey(key);
    try {
      const raw = await this.withTimeout(this.redis.get(fullKey));
      if (!raw) return null;
      return JSON.parse(raw) as T;
    } catch (err: any) {
      this.logger.warn(
        `Redis get failed for '${fullKey}' (${err.message}). Failing open.`,
      );
      return null;
    }
  }

  async set<T>(key: string, value: T, ttlSeconds: number = 300): Promise<void> {
    if (!this.isRedisReady()) return;
    const fullKey = this.qualifyKey(key);
    try {
      const serialized = JSON.stringify(value);
      if (ttlSeconds > 0) {
        await this.withTimeout(
          this.redis.set(fullKey, serialized, 'EX', ttlSeconds),
        );
      } else {
        await this.withTimeout(this.redis.set(fullKey, serialized));
      }
    } catch (err: any) {
      this.logger.warn(
        `Redis set failed for '${fullKey}' (${err.message}). Failing open.`,
      );
    }
  }

  async del(key: string | string[]): Promise<void> {
    const rawKeys = Array.isArray(key) ? key : [key];
    for (const k of rawKeys) {
      this.bumpNamespaceEpoch(k);
    }
    this.inFlight.clear();

    if (!this.isRedisReady()) return;
    try {
      const keys = rawKeys.map((k) => this.qualifyKey(k));
      if (keys.length > 0) {
        await this.withTimeout(this.redis.del(...keys), 500);
      }
    } catch (err: any) {
      this.logger.warn(`Redis del failed (${err.message}).`);
    }
  }

  async delPattern(pattern: string): Promise<void> {
    this.bumpNamespaceEpoch(pattern);

    const prefix = pattern.replace(/\*+$/, '');
    for (const activeKey of this.inFlight.keys()) {
      if (activeKey.startsWith(prefix)) {
        this.inFlight.delete(activeKey);
      }
    }

    if (!this.isRedisReady()) return;
    const qualifiedPattern = this.qualifyKey(pattern);
    try {
      await this.withTimeout(
        (async () => {
          if (typeof this.redis.scanStream === 'function') {
            const stream = this.redis.scanStream({
              match: qualifiedPattern,
              count: 200,
            });
            for await (const keys of stream) {
              if (Array.isArray(keys) && keys.length > 0) {
                await this.redis.del(...keys);
              }
            }
            return;
          }

          let cursor = '0';
          do {
            const [nextCursor, keys] = await this.redis.scan(
              cursor,
              'MATCH',
              qualifiedPattern,
              'COUNT',
              200,
            );
            cursor = nextCursor;
            if (keys.length > 0) {
              await this.redis.del(...keys);
            }
          } while (cursor !== '0');
        })(),
        1000,
      );
    } catch (err: any) {
      this.logger.warn(
        `Redis delPattern failed for '${qualifiedPattern}' (${err.message}).`,
      );
    }
  }

  /**
   * Fail-Open Single-Flight Cache Lookup:
   * 1. Synchronously coalesces duplicate in-flight requests before async cache check.
   * 2. Checks Redis cache (<1ms).
   * 3. On miss, executes database fetcher and populates Redis only if no mutation invalidated the namespace mid-flight.
   * 4. On Redis timeout or error, falls back to direct database execution with zero failure.
   */
  async getOrSet<T>(
    key: string,
    fetcher: () => Promise<T>,
    ttlSeconds: number = 300,
  ): Promise<T> {
    const inFlightPromise = this.inFlight.get(key);
    if (inFlightPromise) {
      return inFlightPromise as Promise<T>;
    }

    const startEpoch = this.getNamespaceEpoch(key);

    const executionPromise = (async () => {
      try {
        const cached = await this.get<T>(key);
        if (cached !== null && cached !== undefined) {
          return cached;
        }

        const freshData = await fetcher();

        // Guard against write-after-invalidate race: skip populating cache if
        // a mutation invalidated this namespace while the DB query ran.
        if (this.getNamespaceEpoch(key) === startEpoch) {
          await this.set(key, freshData, ttlSeconds).catch(() => {});
        }
        return freshData;
      } finally {
        this.inFlight.delete(key);
      }
    })();

    this.inFlight.set(key, executionPromise);
    return executionPromise;
  }
}
