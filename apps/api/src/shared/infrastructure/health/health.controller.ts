import { Controller, Get, HttpStatus, Inject, Res } from '@nestjs/common';
import type { Response } from 'express';
import { sql } from 'drizzle-orm';
import {
  DRIZZLE,
  type DrizzleDB,
} from '../database/postgres/drizzle.provider.js';

@Controller('health')
export class HealthController {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

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
   */
  @Get('readiness')
  async readiness(@Res() res: Response): Promise<void> {
    try {
      await this.db.execute(sql`SELECT 1`);

      res.status(HttpStatus.OK).json({
        status: 'ok',
        database: 'connected',
        timestamp: new Date().toISOString(),
      });
    } catch (err: any) {
      res.status(HttpStatus.SERVICE_UNAVAILABLE).json({
        status: 'error',
        database: 'disconnected',
        error: err.message || 'Database ping failed',
        timestamp: new Date().toISOString(),
      });
    }
  }
}

