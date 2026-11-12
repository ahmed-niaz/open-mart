import { Inject, Injectable, Logger } from '@nestjs/common';
import type { Queue } from 'bullmq';
import {
  type MediaCleanupJobPayload,
  type MediaCleanupPort,
} from '../../application/ports/media-cleanup.port.js';
import {
  STORAGE_SERVICE,
  type StoragePort,
} from '../../../shared/application/ports/storage.port.js';
import { QueueConnectionService } from '../../../shared/infrastructure/queue/queue.service.js';
import { QUEUE_NAMES } from '../../../shared/infrastructure/queue/queue.constants.js';

@Injectable()
export class BullMqMediaCleanupAdapter implements MediaCleanupPort {
  private readonly logger = new Logger(BullMqMediaCleanupAdapter.name);
  private readonly queue: Queue<MediaCleanupJobPayload, any, string>;

  constructor(
    private readonly queueConnection: QueueConnectionService,
    @Inject(STORAGE_SERVICE)
    private readonly storageService: StoragePort,
  ) {
    this.queue = this.queueConnection.getOrCreateQueue<MediaCleanupJobPayload>(
      QUEUE_NAMES.MEDIA_CLEANUP,
      {
        attempts: 5,
        backoff: {
          type: 'exponential',
          delay: 3000,
        },
      },
    );
  }

  async enqueueStorageDelete(payload: MediaCleanupJobPayload): Promise<void> {
    if (this.queueConnection.isProducerReady()) {
      try {
        const job = await this.queue.add('delete-storage-object', payload);
        this.logger.debug(
          `Enqueued R2 purge job '${job.id}' for key '${payload.storageKey}'`,
        );
        return;
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        this.logger.warn(
          `Failed to enqueue R2 purge for '${payload.storageKey}' (${msg}). Failing open to inline R2 delete.`,
        );
      }
    } else {
      this.logger.warn(
        `BullMQ Queue Redis is not ready. Failing open to inline R2 delete for '${payload.storageKey}'.`,
      );
    }

    try {
      await this.storageService.delete(payload.storageKey);
      this.logger.log(
        `Purged asset inline (fail-open) from Cloudflare R2: ${payload.storageKey}`,
      );
    } catch (fallbackErr: unknown) {
      const msg =
        fallbackErr instanceof Error
          ? fallbackErr.message
          : String(fallbackErr);
      this.logger.warn(
        `Inline fail-open R2 purge failed for '${payload.storageKey}': ${msg}`,
      );
    }
  }
}
