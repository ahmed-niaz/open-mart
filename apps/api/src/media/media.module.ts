import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { StorageModule } from '../shared/infrastructure/storage/storage.module.js';

import { MEDIA_REPOSITORY } from './application/ports/media.repository.js';
import { DrizzleMediaRepository } from './infrastructure/adapters/drizzle-media.repository.js';

import { UploadMediaHandler } from './application/commands/upload-media/upload-media.handler.js';
import { UpdateMediaMetadataHandler } from './application/commands/update-media-metadata/update-media-metadata.handler.js';
import { DeleteMediaAssetHandler } from './application/commands/delete-media-asset/delete-media-asset.handler.js';
import { BulkDeleteMediaHandler } from './application/commands/bulk-delete-media/bulk-delete-media.handler.js';

import { ListMediaHandler } from './application/queries/list-media/list-media.handler.js';
import { GetMediaSummaryHandler } from './application/queries/get-media-summary/get-media-summary.handler.js';
import { GetMediaByIdHandler } from './application/queries/get-media-by-id/get-media-by-id.handler.js';

import { MediaAdminController } from './presentation/media-admin.controller.js';

const CommandHandlers = [
  UploadMediaHandler,
  UpdateMediaMetadataHandler,
  DeleteMediaAssetHandler,
  BulkDeleteMediaHandler,
];

const QueryHandlers = [
  ListMediaHandler,
  GetMediaSummaryHandler,
  GetMediaByIdHandler,
];

@Module({
  imports: [CqrsModule, StorageModule],
  controllers: [MediaAdminController],
  providers: [
    {
      provide: MEDIA_REPOSITORY,
      useClass: DrizzleMediaRepository,
    },
    ...CommandHandlers,
    ...QueryHandlers,
  ],
  exports: [MEDIA_REPOSITORY],
})
export class MediaModule {}
