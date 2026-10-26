import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Inject, Logger } from '@nestjs/common';
import { UploadMediaCommand } from './upload-media.command.js';
import {
  MEDIA_REPOSITORY,
  type MediaRepositoryPort,
} from '../../ports/media.repository.js';
import {
  STORAGE_SERVICE,
  type StoragePort,
} from '../../../../shared/application/ports/storage.port.js';
import { MediaAsset } from '../../../domain/entities/media-asset.entity.js';
import type { MediaAssetDto } from '../../dto/media-asset.dto.js';
import {
  ApplicationException,
  ApplicationExceptionCode,
} from '../../../../shared/domain/exceptions/application.exception.js';

@CommandHandler(UploadMediaCommand)
export class UploadMediaHandler implements ICommandHandler<
  UploadMediaCommand,
  MediaAssetDto[]
> {
  private readonly logger = new Logger(UploadMediaHandler.name);

  constructor(
    @Inject(MEDIA_REPOSITORY)
    private readonly mediaRepository: MediaRepositoryPort,
    @Inject(STORAGE_SERVICE)
    private readonly storageService: StoragePort,
  ) {}

  async execute(command: UploadMediaCommand): Promise<MediaAssetDto[]> {
    if (!command.files || command.files.length === 0) {
      throw new ApplicationException(
        'No files provided for upload.',
        ApplicationExceptionCode.VALIDATION_ERROR,
      );
    }

    const uploadedAssets: MediaAssetDto[] = [];

    for (const file of command.files) {
      try {
        const uploadResult = await this.storageService.upload({
          buffer: file.buffer,
          originalName: file.originalName,
          mimeType: file.mimeType,
          folder: command.folder || 'media-library',
        });

        const asset = MediaAsset.create({
          fileName: uploadResult.fileName,
          originalName: file.originalName,
          mimeType: file.mimeType,
          fileSizeBytes: file.size,
          url: uploadResult.url,
          storageKey: uploadResult.key,
          uploadedBy: command.uploadedBy,
        });

        await this.mediaRepository.save(asset);

        uploadedAssets.push({
          id: asset.id.getValue(),
          fileName: asset.fileName,
          originalName: asset.originalName,
          mimeType: asset.mimeType,
          fileSizeBytes: asset.fileSizeBytes,
          url: asset.url,
          storageKey: asset.storageKey,
          altText: asset.altText,
          width: asset.width,
          height: asset.height,
          uploadedBy: asset.uploadedBy,
          usageCount: asset.usageCount,
          isArchived: asset.isArchived,
          version: asset.version,
          createdAt: asset.createdAt.toISOString(),
          updatedAt: asset.updatedAt.toISOString(),
        });
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        this.logger.error(
          `Failed to upload file ${file.originalName}: ${message}`,
        );
        throw new ApplicationException(
          `Failed to process file '${file.originalName}': ${message}`,
          ApplicationExceptionCode.INTERNAL_SERVER_ERROR,
        );
      }
    }

    return uploadedAssets;
  }
}
