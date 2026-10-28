import { Global, Module } from '@nestjs/common';
import { redisProvider } from './redis.provider.js';
import { RedisThrottlerStorage } from './redis-throttler.storage.js';
import { REDIS_CLIENT } from './redis.constants.js';

@Global()
@Module({
  providers: [redisProvider, RedisThrottlerStorage],
  exports: [REDIS_CLIENT, RedisThrottlerStorage],
})
export class RedisModule {}

