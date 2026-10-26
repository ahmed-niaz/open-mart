import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Inject, Logger } from '@nestjs/common';
import { DeleteMediaAssetCommand } from './delete-media-asset.command.js';
import {
  MEDIA_REPOSITORY,
  type MediaRepositoryPort,
} from '../../ports/media.repository.js';
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

    // 1. Delete physical object from Cloudflare R2
    try {
      await this.storageService.delete(asset.storageKey);
      this.logger.log(`Purged asset from Cloudflare R2: ${asset.storageKey}`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.warn(
        `Could not delete asset from storage key '${asset.storageKey}': ${msg}`,
      );
    }

    // 2. Delete database record
    await this.mediaRepository.delete(asset.id);
    this.logger.log(
      `Deleted media asset record from database: ${asset.id.getValue()}`,
    );
  }
}
