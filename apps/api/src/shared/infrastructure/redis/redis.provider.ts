import { Logger, type Provider } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Redis, type RedisOptions } from 'ioredis';
import { REDIS_CLIENT } from './redis.constants.js';

export const redisProvider: Provider = {
  provide: REDIS_CLIENT,
  inject: [ConfigService],
  useFactory: (configService: ConfigService): Redis => {
    const logger = new Logger('RedisProvider');

    const host = configService.get<string>('REDIS_HOST', '127.0.0.1');
    const port = configService.get<number>('REDIS_PORT', 6379);
    const password = configService.get<string>('REDIS_PASSWORD');

    const options: RedisOptions = {
      host,
      port: Number(port),
      password: password && password.trim() !== '' ? password : undefined,
      lazyConnect: true,
      maxRetriesPerRequest: 1,
      connectTimeout: 2000,
      commandTimeout: 200,
      enableOfflineQueue: false,
      retryStrategy: (times: number) => {
        // Exponential backoff capped at 3 seconds
        return Math.min(times * 150, 3000);
      },
    };

    const client = new Redis(options);

    client.on('connect', () => {
      logger.log(`Connected to Redis at ${host}:${port}`);
    });

    client.on('error', (err: any) => {
      // Fail-open: Log warning instead of crashing Node process
      logger.warn(
        `Redis client error (${err.message}). Application will fail open to PostgreSQL.`,
      );
    });

    client.on('close', () => {
      logger.warn(
        'Redis connection closed. Application is operating in fail-open mode.',
      );
    });

    // Attempt non-blocking initial connection
    client.connect().catch((err: any) => {
      logger.warn(
        `Initial Redis connection failed (${err.message}). Running in fail-open mode (direct database fallback).`,
      );
    });

    return client;
  },
};
