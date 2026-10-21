import { Global, Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';

import { OutboxService } from './outbox.service.js';
import { EventDeduplicationService } from './event-deduplication.service.js';
import { OutboxProcessorJob } from './outbox-processor.job.js';
import { DrizzleModule } from '../database/postgres/drizzle.module.js';

@Global()
@Module({
  imports: [CqrsModule, DrizzleModule],
  providers: [OutboxService, EventDeduplicationService, OutboxProcessorJob],
  exports: [OutboxService, EventDeduplicationService],
})
export class OutboxModule {}

