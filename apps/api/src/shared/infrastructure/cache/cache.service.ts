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
  private readonly timeoutMs = 200; // 200ms timeout to ensure low-latency response

  constructor(@Inject(REDIS_CLIENT) private readonly redis: Redis) {}

  private qualifyKey(key: string): string {
    return key.startsWith('om:') ? key : `om:cache:${key}`;
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

  async get<T>(key: string): Promise<T | null> {
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

  async set<T>(
    key: string,
    value: T,
    ttlSeconds: number = 300,
  ): Promise<void> {
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
    try {
      const keys = (Array.isArray(key) ? key : [key]).map((k) =>
        this.qualifyKey(k),
      );
      if (keys.length > 0) {
        await this.withTimeout(this.redis.del(...keys));
      }
    } catch (err: any) {
      this.logger.warn(`Redis del failed (${err.message}).`);
    }
  }

  async delPattern(pattern: string): Promise<void> {
    const qualifiedPattern = this.qualifyKey(pattern);
    try {
      // Use non-blocking SCAN to find matching keys
      const stream = this.redis.scanStream({
        match: qualifiedPattern,
        count: 100,
      });

      const keysToDelete: string[] = [];
      for await (const resultKeys of stream) {
        if (resultKeys.length > 0) {
          keysToDelete.push(...resultKeys);
        }
      }

      if (keysToDelete.length > 0) {
        await this.withTimeout(this.redis.del(...keysToDelete));
      }
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
   * 3. On miss, executes database fetcher and populates Redis.
   * 4. On Redis timeout or error, falls back to direct database execution with zero failure.
   */
  async getOrSet<T>(
    key: string,
    fetcher: () => Promise<T>,
    ttlSeconds: number = 300,
  ): Promise<T> {
    // 1. Single-Flight coalescing check: return existing pending execution if active
    const inFlightPromise = this.inFlight.get(key);
    if (inFlightPromise) {
      return inFlightPromise as Promise<T>;
    }

    // 2. Synchronously register execution in inFlight map before entering async pipeline
    const executionPromise = (async () => {
      try {
        // Check Redis cache first
        const cached = await this.get<T>(key);
        if (cached !== null && cached !== undefined) {
          return cached;
        }

        // Cache miss: execute database fetcher
        const freshData = await fetcher();
        // Asynchronously populate Redis cache
        this.set(key, freshData, ttlSeconds).catch(() => {});
        return freshData;
      } finally {
        this.inFlight.delete(key);
      }
    })();

    this.inFlight.set(key, executionPromise);
    return executionPromise;
  }
}
