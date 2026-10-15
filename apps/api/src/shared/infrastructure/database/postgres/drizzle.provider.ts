import { ConfigService } from '@nestjs/config';
import { sql } from 'drizzle-orm';
import { drizzle, PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema/index.js';

export const DRIZZLE = Symbol('DRIZZLE');

export type DrizzleDB = PostgresJsDatabase<typeof schema>;

export const DrizzleProvider = {
  provide: DRIZZLE,
  inject: [ConfigService],
  useFactory: async (configService: ConfigService): Promise<DrizzleDB> => {
    const connectionString =
      configService.getOrThrow<string>('POSTGRES_DB_URL');

    const client = postgres(connectionString);
    const pgdb = drizzle(client, {
      schema,
    });
    await pgdb.execute(sql`SELECT 1`);
    return pgdb;
  },
};
