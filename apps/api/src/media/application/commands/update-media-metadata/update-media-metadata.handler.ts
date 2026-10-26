import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { UpdateMediaMetadataCommand } from './update-media-metadata.command.js';
import {
  MEDIA_REPOSITORY,
  type MediaRepositoryPort,
} from '../../ports/media.repository.js';
import { MediaId } from '../../../domain/value-objects/media-id.vo.js';
import {
  ApplicationException,
  ApplicationExceptionCode,
} from '../../../../shared/domain/exceptions/application.exception.js';
import type { MediaAssetDto } from '../../dto/media-asset.dto.js';

@CommandHandler(UpdateMediaMetadataCommand)
export class UpdateMediaMetadataHandler implements ICommandHandler<
  UpdateMediaMetadataCommand,
  MediaAssetDto
> {
  constructor(
    @Inject(MEDIA_REPOSITORY)
    private readonly mediaRepository: MediaRepositoryPort,
  ) {}

  async execute(command: UpdateMediaMetadataCommand): Promise<MediaAssetDto> {
    const mediaId = new MediaId(command.id);
    const asset = await this.mediaRepository.findById(mediaId);

    if (!asset) {
      throw new ApplicationException(
        `Media asset with ID '${command.id}' not found.`,
        ApplicationExceptionCode.NOT_FOUND,
      );
    }

    asset.updateMetadata({
      altText: command.altText,
      originalName: command.originalName,
    });

    await this.mediaRepository.save(asset);

    return {
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
    };
  }
}
