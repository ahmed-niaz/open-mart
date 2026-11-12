import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import type { Job } from 'bullmq';
import type { MediaCleanupJobPayload } from '../../application/ports/media-cleanup.port.js';
import {
  STORAGE_SERVICE,
  type StoragePort,
} from '../../../shared/application/ports/storage.port.js';
import { QueueConnectionService } from '../../../shared/infrastructure/queue/queue.service.js';
import { QUEUE_NAMES } from '../../../shared/infrastructure/queue/queue.constants.js';

@Injectable()
export class MediaCleanupWorkerProcessor implements OnModuleInit {
  private readonly logger = new Logger(MediaCleanupWorkerProcessor.name);

  constructor(
    private readonly queueConnection: QueueConnectionService,
    @Inject(STORAGE_SERVICE)
    private readonly storageService: StoragePort,
  ) {}

  onModuleInit(): void {
    if (!this.queueConnection.shouldRunWorkers()) {
      return;
    }

    this.queueConnection.createWorker<MediaCleanupJobPayload>(
      QUEUE_NAMES.MEDIA_CLEANUP,
      async (job: Job<MediaCleanupJobPayload>) => {
        this.logger.log(
          `Purging object '${job.data.storageKey}' from Cloudflare R2 (job=${job.id}, attempt=${job.attemptsMade + 1})`,
        );
        await this.storageService.delete(job.data.storageKey);
      },
      { concurrency: 5 },
    );
  }
}
