import { Module } from '@nestjs/common';
import { HealthController } from './health.controller.js';
import { DrizzleModule } from '../database/postgres/drizzle.module.js';

@Module({
  imports: [DrizzleModule],
  controllers: [HealthController],
})
export class HealthModule {}

