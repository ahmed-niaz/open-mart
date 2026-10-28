import { Inject, Injectable, Logger } from '@nestjs/common';
import type { ThrottlerStorage } from '@nestjs/throttler';
import { Redis } from 'ioredis';
import { REDIS_CLIENT } from './redis.constants.js';

type ThrottlerStorageRecord = Awaited<ReturnType<ThrottlerStorage['increment']>>;

@Injectable()
export class RedisThrottlerStorage implements ThrottlerStorage {
  private readonly logger = new Logger(RedisThrottlerStorage.name);

  // Atomic Lua script: increments counter and initializes PEXPIRE on first hit
  private readonly atomicIncrScript = `
    local current = redis.call('INCR', KEYS[1])
    local pttl = redis.call('PTTL', KEYS[1])
    if pttl < 0 then
      redis.call('PEXPIRE', KEYS[1], ARGV[1])
      pttl = tonumber(ARGV[1])
    end
    return { current, pttl }
  `;

  constructor(@Inject(REDIS_CLIENT) private readonly redis: Redis) {}

  async increment(
    key: string,
    ttl: number,
    limit: number,
    blockDuration: number,
    throttlerName: string,
  ): Promise<ThrottlerStorageRecord> {
    const redisKey = `om:throttle:${throttlerName}:${key}`;
    const blockKey = `om:throttle:block:${throttlerName}:${key}`;

    try {
      // 1. Check if key is currently blocked
      if (blockDuration > 0) {
        const blockPttl = await this.redis.pttl(blockKey);
        if (blockPttl > 0) {
          const timeToBlockExpire = Math.ceil(blockPttl / 1000);
          return {
            totalHits: limit + 1,
            timeToExpire: timeToBlockExpire,
            isBlocked: true,
            timeToBlockExpire,
          };
        }
      }

      // 2. Increment hits atomically
      const result = (await this.redis.eval(
        this.atomicIncrScript,
        1,
        redisKey,
        ttl,
      )) as [number, number];

      const totalHits = Number(result[0]);
      const pttl = Number(result[1]);
      const timeToExpire = Math.max(1, Math.ceil(pttl / 1000));
      const isBlocked = totalHits > limit;

      // 3. Set block duration if threshold exceeded
      let timeToBlockExpire = 0;
      if (isBlocked && blockDuration > 0) {
        await this.redis.set(blockKey, '1', 'PX', blockDuration);
        timeToBlockExpire = Math.ceil(blockDuration / 1000);
      }

      return {
        totalHits,
        timeToExpire,
        isBlocked,
        timeToBlockExpire,
      };
    } catch (err: any) {
      // Fail-open: If Redis is unavailable, allow the request rather than blocking users
      this.logger.warn(
        `Throttler Redis operation failed (${err.message}). Failing open to allow request.`,
      );
      return {
        totalHits: 1,
        timeToExpire: Math.ceil(ttl / 1000),
        isBlocked: false,
        timeToBlockExpire: 0,
      };
    }
  }
}
