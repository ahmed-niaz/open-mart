import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { sql } from 'drizzle-orm';
import { drizzle, PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema/index.js';

export const DRIZZLE = Symbol('DRIZZLE');

export type DrizzleDB = PostgresJsDatabase<typeof schema>;

/**
 * Safely parses and sanitizes integer values from environment variables.
 */
function parsePositiveInt(
  value: string | number | undefined,
  fallback: number,
): number {
  if (value === undefined || value === null || value === '') {
    return fallback;
  }
  const parsed =
    typeof value === 'number' ? value : parseInt(String(value).trim(), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export const DrizzleProvider = {
  provide: DRIZZLE,
  inject: [ConfigService],
  useFactory: async (configService: ConfigService): Promise<DrizzleDB> => {
    const logger = new Logger('DrizzleProvider');
    const connectionString =
      configService.getOrThrow<string>('POSTGRES_DB_URL');

    // Parse and sanitize connection pool options from environment (.env)
    const maxConnections = parsePositiveInt(
      configService.get('DB_POOL_MAX'),
      20,
    );
    const idleTimeoutSeconds = parsePositiveInt(
      configService.get('DB_POOL_IDLE_TIMEOUT'),
      30,
    );
    const connectTimeoutSeconds = parsePositiveInt(
      configService.get('DB_POOL_CONNECT_TIMEOUT'),
      10,
    );

    logger.log(
      `Initializing PostgreSQL pool (max: ${maxConnections}, idleTimeout: ${idleTimeoutSeconds}s, connectTimeout: ${connectTimeoutSeconds}s)`,
    );

    const client = postgres(connectionString, {
      max: maxConnections,
      idle_timeout: idleTimeoutSeconds,
      connect_timeout: connectTimeoutSeconds,
      max_lifetime: 60 * 30, // 30 minutes connection lifetime recycling
    });

    const pgdb = drizzle(client, {
      schema,
    });

    // Verification probe
    await pgdb.execute(sql`SELECT 1`);
    logger.log('PostgreSQL connection verified successfully.');

    return pgdb;
  },
};
