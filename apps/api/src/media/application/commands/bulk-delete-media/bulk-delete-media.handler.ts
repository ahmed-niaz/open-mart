import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Inject, Logger, Optional } from '@nestjs/common';
import { BulkDeleteMediaCommand } from './bulk-delete-media.command.js';
import {
  MEDIA_REPOSITORY,
  type MediaRepositoryPort,
} from '../../ports/media.repository.js';
import {
  MEDIA_CLEANUP_PORT,
  type MediaCleanupPort,
} from '../../ports/media-cleanup.port.js';
import {
  STORAGE_SERVICE,
  type StoragePort,
} from '../../../../shared/application/ports/storage.port.js';
import { MediaId } from '../../../domain/value-objects/media-id.vo.js';

@CommandHandler(BulkDeleteMediaCommand)
export class BulkDeleteMediaHandler implements ICommandHandler<
  BulkDeleteMediaCommand,
  { deletedCount: number }
> {
  private readonly logger = new Logger(BulkDeleteMediaHandler.name);

  constructor(
    @Inject(MEDIA_REPOSITORY)
    private readonly mediaRepository: MediaRepositoryPort,
    @Inject(STORAGE_SERVICE)
    private readonly storageService: StoragePort,
    @Optional()
    @Inject(MEDIA_CLEANUP_PORT)
    private readonly mediaCleanup?: MediaCleanupPort,
  ) {}

  async execute(
    command: BulkDeleteMediaCommand,
  ): Promise<{ deletedCount: number }> {
    if (!command.ids || command.ids.length === 0) {
      return { deletedCount: 0 };
    }

    let deletedCount = 0;
    for (const rawId of command.ids) {
      try {
        const mediaId = new MediaId(rawId);
        const asset = await this.mediaRepository.findById(mediaId);
        if (!asset) continue;

        if (asset.usageCount > 0 && !command.force) {
          this.logger.warn(
            `Skipping bulk delete for asset '${asset.id.getValue()}' due to active usage (${asset.usageCount} products).`,
          );
          continue;
        }

        if (this.mediaCleanup) {
          await this.mediaRepository.delete(asset.id);
          await this.mediaCleanup.enqueueStorageDelete({
            storageKey: asset.storageKey,
            mediaId: asset.id.getValue(),
            reason: 'bulk_delete_media',
          });
        } else {
          try {
            await this.storageService.delete(asset.storageKey);
          } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : String(err);
            this.logger.warn(
              `Could not delete storage key '${asset.storageKey}': ${msg}`,
            );
          }

          await this.mediaRepository.delete(asset.id);
        }
        deletedCount++;
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        this.logger.error(`Error processing bulk delete for ${rawId}: ${msg}`);
      }
    }

    return { deletedCount };
  }
}
