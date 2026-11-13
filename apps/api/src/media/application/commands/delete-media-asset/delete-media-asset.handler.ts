import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Inject, Logger, Optional } from '@nestjs/common';
import { DeleteMediaAssetCommand } from './delete-media-asset.command.js';
import {
  MEDIA_REPOSITORY,
  type MediaRepositoryPort,
} from '../../ports/media.repository.js';
import {
  MEDIA_CLEANUP_PORT,
  type MediaCleanupPort,
} from '../../ports/media-cleanup.port.js';
import {
  PRODUCT_MEDIA_DETACHER_PORT,
  type ProductMediaDetacherPort,
} from '../../ports/product-media-detacher.port.js';
import {
  STORAGE_SERVICE,
  type StoragePort,
} from '../../../../shared/application/ports/storage.port.js';
import { MediaId } from '../../../domain/value-objects/media-id.vo.js';
import {
  ApplicationException,
  ApplicationExceptionCode,
} from '../../../../shared/domain/exceptions/application.exception.js';

@CommandHandler(DeleteMediaAssetCommand)
export class DeleteMediaAssetHandler implements ICommandHandler<
  DeleteMediaAssetCommand,
  void
> {
  private readonly logger = new Logger(DeleteMediaAssetHandler.name);

  constructor(
    @Inject(MEDIA_REPOSITORY)
    private readonly mediaRepository: MediaRepositoryPort,
    @Inject(STORAGE_SERVICE)
    private readonly storageService: StoragePort,
    @Optional()
    @Inject(MEDIA_CLEANUP_PORT)
    private readonly mediaCleanup?: MediaCleanupPort,
    @Optional()
    @Inject(PRODUCT_MEDIA_DETACHER_PORT)
    private readonly productMediaDetacher?: ProductMediaDetacherPort,
  ) {}

  async execute(command: DeleteMediaAssetCommand): Promise<void> {
    const mediaId = new MediaId(command.id);
    const asset = await this.mediaRepository.findById(mediaId);

    if (!asset) {
      throw new ApplicationException(
        `Media asset with ID '${command.id}' not found.`,
        ApplicationExceptionCode.NOT_FOUND,
      );
    }

    if (asset.usageCount > 0 && !command.force) {
      throw new ApplicationException(
        `Cannot delete media asset '${asset.originalName}' because it is currently linked to ${asset.usageCount} product(s). Use force=true to delete permanently anyway.`,
        ApplicationExceptionCode.CONFLICT,
      );
    }

    // Detach deleted media from all products referencing it so it is unavailable everywhere
    if (this.productMediaDetacher) {
      try {
        const detached =
          await this.productMediaDetacher.detachMediaUrlsFromAllProducts([
            asset.url,
          ]);
        if (detached > 0) {
          this.logger.log(
            `Detached deleted asset '${asset.url}' from ${detached} product(s).`,
          );
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        this.logger.warn(
          `Failed to detach media '${asset.url}' from products: ${msg}`,
        );
      }
    }

    if (this.mediaCleanup) {
      // Delete database record first, then enqueue asynchronous R2 purge with retries
      await this.mediaRepository.delete(asset.id);
      this.logger.log(
        `Deleted media asset record from database: ${asset.id.getValue()}`,
      );
      await this.mediaCleanup.enqueueStorageDelete({
        storageKey: asset.storageKey,
        mediaId: asset.id.getValue(),
        reason: 'delete_media_asset',
      });
      return;
    }

    // Synchronous fallback (e.g., direct unit test instantiation without queue port)
    try {
      await this.storageService.delete(asset.storageKey);
      this.logger.log(`Purged asset from Cloudflare R2: ${asset.storageKey}`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.warn(
        `Could not delete asset from storage key '${asset.storageKey}': ${msg}`,
      );
    }

    await this.mediaRepository.delete(asset.id);
    this.logger.log(
      `Deleted media asset record from database: ${asset.id.getValue()}`,
    );
  }
}
