import { defineConfig } from 'drizzle-kit';
import * as dotenv from 'dotenv';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

// Load environment variables from apps/api/.env or current working directory
const envPaths = [
  resolve(process.cwd(), '.env.local'),
  resolve(process.cwd(), '.env'),
  resolve(process.cwd(), 'apps/api/.env.local'),
  resolve(process.cwd(), 'apps/api/.env'),
];

for (const envPath of envPaths) {
  if (existsSync(envPath)) {
    dotenv.config({ path: envPath });
  }
}

export default defineConfig({
  dialect: 'postgresql',
  schema: './src/shared/infrastructure/database/postgres/schema/index.ts',
  out: './drizzle',
  dbCredentials: {
    url: process.env.POSTGRES_DB_URL ?? '',
  },
  strict: true,
  verbose: true,
});
