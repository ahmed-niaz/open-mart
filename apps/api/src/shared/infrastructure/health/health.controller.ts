import { Controller, Get, HttpStatus, Inject, Res } from '@nestjs/common';
import type { Response } from 'express';
import { sql } from 'drizzle-orm';
import { Redis } from 'ioredis';
import {
  DRIZZLE,
  type DrizzleDB,
} from '../database/postgres/drizzle.provider.js';
import { REDIS_CLIENT } from '../redis/redis.constants.js';

@Controller('health')
export class HealthController {
  constructor(
    @Inject(DRIZZLE) private readonly db: DrizzleDB,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {}

  /**
   * Liveness probe: verifies that the HTTP server process is running and responsive.
   */
  @Get('liveness')
  liveness(@Res() res: Response): void {
    res.status(HttpStatus.OK).json({
      status: 'ok',
      uptimeSeconds: Math.floor(process.uptime()),
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Readiness probe: verifies that the server can reach primary persistence (PostgreSQL).
   * Notice: If Redis is unreachable, it logs 'degraded' but fails open with HTTP 200 OK.
   */
  @Get('readiness')
  async readiness(@Res() res: Response): Promise<void> {
    let redisStatus = 'degraded (failing open)';
    try {
      const pong = await Promise.race([
        this.redis.ping(),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('timeout')), 100),
        ),
      ]);
      if (pong === 'PONG') {
        redisStatus = 'connected';
      }
    } catch {
      redisStatus = 'degraded (failing open)';
    }

    try {
      await this.db.execute(sql`SELECT 1`);

      res.status(HttpStatus.OK).json({
        status: 'ok',
        database: 'connected',
        redis: redisStatus,
        timestamp: new Date().toISOString(),
      });
    } catch (err: any) {
      res.status(HttpStatus.SERVICE_UNAVAILABLE).json({
        status: 'error',
        database: 'disconnected',
        redis: redisStatus,
        error: err.message || 'Database ping failed',
        timestamp: new Date().toISOString(),
      });
    }
  }
}
